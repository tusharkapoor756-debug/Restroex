import { SessionService } from '../conversations/session.service';
import { VariantHandler } from './handlers/variant.handler';
import { RestaurantRepository } from '../restaurants/repositories/restaurant.repository';
import { GreetingHandler } from './handlers/greeting.handler';
import { MenuHandler } from './handlers/menu.handler';
import { CheckoutHandler } from './handlers/checkout.handler';
import { MenuRepository } from '../menu/repositories/menu.repository';
import { WhatsAppMessageService } from './message.service';
import { logger } from '../../infrastructure/logger/logger';
import { db } from '../../infrastructure/database/database.client';
import { MenuMappingItem } from '../ai/types/parser.types';
import { ConversationState } from '../conversations/conversation.states';
import { getDisplayName } from '../../shared/utils/display-name.util';
import { conversationMemoryService } from '../ai/services/conversation-memory.service';
import { aiEmployeeService } from '../ai/services/ai-employee.service';
import { interactiveOrderingService } from './interactive/interactive-ordering.service';
import { WhatsAppConfigRepository } from '../restaurants/repositories/whatsapp-config.repository';
import { classifyOrderingIntent } from './interactive/ordering-intent-classifier';
import { PaymentService } from '../payments/services/payment.service';


interface IncomingWhatsAppPayload {
  restaurantId: string;
  customerPhone: string;
  from: string;
  textBody: string;
  interactivePayload?: string;
  content?: {
    type: string;
    body?: string;
    mediaPath?: string;
    [key: string]: any;
  };
  mediaId?: string | null;
  mediaType?: string | null;
}

export class WhatsAppBotReplyService {
  private readonly menuRepository: MenuRepository;
  private readonly restaurantRepository: RestaurantRepository;
  private readonly messages: WhatsAppMessageService;
  private readonly menuHandler: MenuHandler;
  private readonly checkoutHandler: CheckoutHandler;
  private readonly greetingHandler: GreetingHandler;
  private readonly variantHandler: VariantHandler;
  private readonly sessionService: SessionService;
  private readonly whatsappConfigRepo: WhatsAppConfigRepository;

  constructor() {
    this.menuRepository = new MenuRepository();
    this.restaurantRepository = new RestaurantRepository();
    this.messages = new WhatsAppMessageService();
    this.menuHandler = new MenuHandler();
    this.checkoutHandler = new CheckoutHandler();
    this.greetingHandler = new GreetingHandler();
    this.variantHandler = new VariantHandler();
    this.sessionService = new SessionService();
    this.whatsappConfigRepo = new WhatsAppConfigRepository();
  }

  public async handleIncomingMessage(payload: IncomingWhatsAppPayload): Promise<void> {
    logger.info({ payload }, 'Enter handleIncomingMessage');
    const restaurantId = payload.restaurantId;
    const customerPhone = payload.customerPhone || payload.from;
    const text = String(payload.textBody || '').trim();

    if (!restaurantId || !customerPhone) return;

    try {
      await this.sessionService.runPipelineLocked(restaurantId, customerPhone, async () => {
        // ── Memory: persist inbound user message (fire-and-forget) ───────────
        conversationMemoryService.saveMessage(restaurantId, customerPhone, 'user', text).catch(() => undefined);

        let session = await this.sessionService.getSession(restaurantId, customerPhone);
      
      // ── Validate FSM state against database entities to prevent stuck states ──
      if (session.state === ConversationState.AWAITING_PAYMENT_SCREENSHOT || session.state === ConversationState.AWAITING_PAYMENT) {
        // If the provider already flagged that media download failed, this is NOT a stale session.
        // A Puppeteer/network failure is never evidence that the order is complete or cancelled.
        // Short-circuit immediately and let Layer 0 handle the resend prompt.
        const incomingMediaFailed = payload.content?.mediaFailed || (payload as any).mediaFailed;
        if (incomingMediaFailed) {
          logger.info({ customerPhone }, 'Stale check skipped: mediaFailed=true. FSM stays in AWAITING_PAYMENT_SCREENSHOT.');
          // Fall through to Layer 0 — no stale reset.
        } else {
          let isStale = false;
          try {
            // Use the checkoutOrderId stored in session context — this is set at checkout time
            // and is authoritative. Querying "latest order by phone" is unreliable because
            // a different completed order can be returned, causing getPaymentByOrder to return
            // null and falsely mark the session as stale.
            const checkoutOrderId = session.context?.checkoutOrderId as string | undefined;

            if (!checkoutOrderId) {
              // No order in context — genuinely stale, no checkout was started
              isStale = true;
              logger.warn({ customerPhone }, 'Stale check: no checkoutOrderId in session context. Marking stale.');
            } else {
              const orderResult = await db.getClient()
                .from('orders')
                .select('id, status')
                .eq('id', checkoutOrderId)
                .maybeSingle();

              if (!orderResult.data) {
                isStale = true;
                logger.warn({ customerPhone, checkoutOrderId }, 'Stale check: checkoutOrderId not found in orders table. Marking stale.');
              } else {
                const order = orderResult.data;
                if (['completed', 'cancelled', 'paid', 'accepted', 'preparing', 'ready'].includes(order.status)) {
                  isStale = true;
                  logger.info({ customerPhone, checkoutOrderId, status: order.status }, 'Stale check: order already beyond payment stage. Marking stale.');
                } else {
                  const paymentService = new PaymentService();
                  const payment = await paymentService.getPaymentByOrder(order.id);
                  if (!payment || ['cancelled', 'verified', 'rejected', 'failed'].includes(payment.paymentStatus)) {
                    isStale = true;
                    logger.info({ customerPhone, checkoutOrderId, paymentStatus: payment?.paymentStatus }, 'Stale check: payment is terminal or missing. Marking stale.');
                  }
                }
              }
            }
          } catch (err) {
            logger.error({ err }, 'Error in stale payment check');
            isStale = false; // Do not reset FSM to IDLE on errors!
          }

          if (isStale) {
            logger.info({ customerPhone }, 'FSM state AWAITING_PAYMENT_SCREENSHOT/PAYMENT is stale. Resetting session state to IDLE.');
            await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
              event: { name: 'RESET' }
            }));
            session = await this.sessionService.getSession(restaurantId, customerPhone);
          }
        }
      }

      logger.info({ state: session.state }, 'Current Conversation State');

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 0 — Payment screenshot handling (state-locked, must run first)
      // ─────────────────────────────────────────────────────────────────────
      if (session.state === ConversationState.AWAITING_PAYMENT_SCREENSHOT) {
        const directIntent = classifyOrderingIntent(text);
        if (directIntent && directIntent.a === ('track_order' as any)) {
          const lastOrderResult = await db.getClient()
            .from('orders')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastOrderResult.data) {
            const order = lastOrderResult.data;
            const statusTimelineMap: Record<string, string> = {
              checkout_pending: '⏳ Checkout Pending',
              payment_pending: '💳 Payment Pending',
              paid: '✅ Paid',
              accepted: '🍳 Restaurant Accepted',
              preparing: '🍳 Food is being prepared',
              ready: '🔔 Food is ready!',
              completed: '❤️ Delivered',
              cancelled: '❌ Cancelled',
            };

            const statesOrder = ['checkout_pending', 'payment_pending', 'paid', 'accepted', 'preparing', 'ready', 'completed'];
            const currentIdx = statesOrder.indexOf(order.status);
            
            let trackingMsg = `🍽️ *Your Order Status (${order.human_readable_id})*\n\n`;
            statesOrder.forEach((st) => {
              const stIdx = statesOrder.indexOf(st);
              const bullet = st === 'cancelled' || order.status === 'cancelled'
                ? (order.status === 'cancelled' && st === 'cancelled' ? '❌' : '⬜')
                : (stIdx <= currentIdx ? '✅' : '⬜');
              trackingMsg += `${bullet} ${statusTimelineMap[st] || st}\n`;
            });

            await this.messages.sendText(restaurantId, customerPhone, trackingMsg);
            return;
          }
        }

        const mediaPath = payload.content?.mediaPath || (payload as any).mediaPath;
        const mediaFailed = payload.content?.mediaFailed || (payload as any).mediaFailed;

        // If the WhatsApp provider already flagged that all downloadMedia retries failed,
        // do NOT advance or reset the FSM — just ask the customer to resend the screenshot.
        if (mediaFailed) {
          logger.warn({ restaurantId, customerPhone }, 'mediaFailed=true received. Keeping FSM in AWAITING_PAYMENT_SCREENSHOT and asking customer to resend.');
          await this.messages.sendText(restaurantId, customerPhone, "I couldn't process your payment screenshot. Please send it again.");
          return;
        }

        if (mediaPath) {
          try {
            const paymentService = new PaymentService();
            const orderResult = await db.getClient()
              .from('orders')
              .select('id')
              .eq('restaurant_id', restaurantId)
              .eq('customer_phone', customerPhone)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (orderResult.data) {
              const payment = await paymentService.getPaymentByOrder(orderResult.data.id);
              if (payment) {
                const { storageService } = require('../../infrastructure/storage/storage.service');
                const tmpInnerPath: string = mediaPath;
                const finalInnerPath = `${restaurantId}/${payment.id}/${payment.paymentAttempt}/screenshot.jpg`;
                const finalStoragePath: string = await storageService.move('payments', tmpInnerPath, finalInnerPath);
                await paymentService.uploadScreenshot(payment.id, finalStoragePath);
                await paymentService.markPendingVerification(payment.id);
                await this.messages.sendText(restaurantId, customerPhone, 'Payment screenshot received.\nPlease wait while the restaurant verifies your payment.');
                return;
              }
            }
          } catch (error) {
            logger.error({ error }, 'Failed to process screenshot upload');
            await this.messages.sendText(restaurantId, customerPhone, 'Sorry, we encountered an error processing your screenshot. Please try again.');
            return;
          }
        } else {
          // If they already uploaded it and are waiting
          const lastOrderResult = await db.getClient()
            .from('orders')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastOrderResult.data) {
            const paymentService = new PaymentService();
            const payment = await paymentService.getPaymentByOrder(lastOrderResult.data.id);
            if (payment && (payment.paymentStatus === 'pending_verification' || payment.paymentStatus === 'screenshot_uploaded')) {
              await this.messages.sendText(restaurantId, customerPhone, 'Payment screenshot received.\nPlease wait while the restaurant verifies your payment.');
              return;
            }
          }

          await this.messages.sendText(restaurantId, customerPhone, 'Please send an image of your payment screenshot.');
          return;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 0.5 — Customer Profile Onboarding & Identity Check
      // ─────────────────────────────────────────────────────────────────────
      const { customerService } = require('../customers/services/customer.service');
      let customer = await customerService.getOrCreateCustomer(restaurantId, customerPhone);

      // Onboarding State Handlers
      if (session.state === ConversationState.AWAITING_NAME) {
        if (!text) {
          await this.messages.sendText(restaurantId, customerPhone, 'Please reply with your name.');
          return;
        }
        await customerService.updateCustomerProfile(customer.id, { name: text });
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'PROVIDE_NAME' }
        }));
        await this.messages.sendText(restaurantId, customerPhone, `Thanks ${text}! Please reply with your delivery Address.`);
        return;
      }

      if (session.state === ConversationState.AWAITING_ADDRESS) {
        if (!text) {
          await this.messages.sendText(restaurantId, customerPhone, 'Please reply with your address.');
          return;
        }
        await customerService.updateCustomerProfile(customer.id, { address: text });
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'PROVIDE_ADDRESS' }
        }));

        // Render confirmation message
        customer = await customerService.findById(customer.id);
        const confirmText = `Verify Profile:\n\n👤 *Name:* ${customer.name}\n📍 *Address:* ${customer.address}\n\nIs this correct? Reply "yes" to confirm, or "edit" to change it.`;
        await this.messages.sendText(restaurantId, customerPhone, confirmText);
        return;
      }

      if (session.state === ConversationState.AWAITING_PROFILE_CONFIRMATION) {
        const cleanText = text.toLowerCase().trim();
        if (cleanText === 'yes' || cleanText === 'confirm') {
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
            event: { name: 'CONFIRM_PROFILE' }
          }));
          await this.messages.sendText(restaurantId, customerPhone, '✅ Profile confirmed. Let\'s continue with your order.');
          // Redirect to menu browse
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'home' });
          return;
        } else if (cleanText === 'edit' || cleanText === 'no') {
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
            event: { name: 'EDIT_PROFILE' }
          }));
          await this.messages.sendText(restaurantId, customerPhone, 'Let\'s correct it. What is your Name?');
          return;
        } else {
          await this.messages.sendText(restaurantId, customerPhone, 'Please reply with "yes" or "edit".');
          return;
        }
      }

      // Check if existing customer has incomplete profile
      if (!customer.name || !customer.address) {
        logger.info({ customerId: customer.id }, 'Customer profile is incomplete. Triggering onboarding.');
        // Use a proper FSM transition (IDLE → AWAITING_NAME) instead of raw SQL override
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'RESET' } // First reset to IDLE so we can START_ONBOARDING from a clean state
        }));
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'START_ONBOARDING' } // IDLE → AWAITING_NAME via FSM
        }));

        await this.messages.sendText(
          restaurantId,
          customerPhone,
          'Welcome to Restroex! 🍽️\n\nLet\'s setup your ordering profile. What is your Name?'
        );
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 0.6 — Smart Priority Routing (Part 1, 7, 9)
      // ─────────────────────────────────────────────────────────────────────
      const directIntent = classifyOrderingIntent(text);
      
      if (directIntent && directIntent.a === ('track_order' as any)) {
        logger.info({ customerPhone }, 'Route Action: Displaying Order Tracking Timeline');
        // Fetch last order
        const lastOrderResult = await db.getClient()
          .from('orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('customer_phone', customerPhone)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastOrderResult.data) {
          const order = lastOrderResult.data;
          const statusTimelineMap: Record<string, string> = {
            checkout_pending: '⏳ Checkout Pending',
            payment_pending: '💳 Payment Pending',
            paid: '✅ Paid',
            accepted: '🍳 Restaurant Accepted',
            preparing: '🍳 Food is being prepared',
            ready: '🔔 Food is ready!',
            completed: '❤️ Delivered',
            cancelled: '❌ Cancelled',
          };

          const statesOrder = ['checkout_pending', 'payment_pending', 'paid', 'accepted', 'preparing', 'ready', 'completed'];
          const currentIdx = statesOrder.indexOf(order.status);
          
          let trackingMsg = `🍽️ *Your Order Status (${order.human_readable_id})*\n\n`;
          statesOrder.forEach((st) => {
            const stIdx = statesOrder.indexOf(st);
            const bullet = st === 'cancelled' || order.status === 'cancelled'
              ? (order.status === 'cancelled' && st === 'cancelled' ? '❌' : '⬜')
              : (stIdx <= currentIdx ? '✅' : '⬜');
            trackingMsg += `${bullet} ${statusTimelineMap[st] || st}\n`;
          });

          await this.messages.sendText(restaurantId, customerPhone, trackingMsg);
        } else {
          await this.messages.sendText(restaurantId, customerPhone, 'You do not have any orders to track yet.');
        }
        return;
      }

      if (directIntent && directIntent.a === ('profile_update' as any)) {
        logger.info({ customerPhone }, 'Route Action: Updating Customer Profile');
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'RESET' }
        }));
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'START_ONBOARDING' } // IDLE → AWAITING_NAME via FSM
        }));
        await this.messages.sendText(restaurantId, customerPhone, 'Let\'s update your profile. What is your Name?');
        return;
      }

      if (directIntent && directIntent.a === ('payment_confirm_intent' as any)) {
        logger.info({ customerPhone }, 'Route Action: Payment Confirm Intent');
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'AWAIT_PAYMENT_SCREENSHOT' }
        }));
        await this.messages.sendText(restaurantId, customerPhone, 'Please send an image of your payment screenshot to verify payment.');
        return;
      }

      if (directIntent && directIntent.a === ('talk_to_staff' as any)) {
        logger.info({ customerPhone }, 'Route Action: Talk to Staff Support');
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'TRIGGER_TAKEOVER' }
        }));
        await this.messages.sendText(restaurantId, customerPhone, 'Connecting you to staff support. An agent will reply shortly.');
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 0.7 — Cart Recovery & Session Lifecycle (Part 2, 3, 4, 5, 6)
      // ─────────────────────────────────────────────────────────────────────
      const { cartService: innerCartService } = require('../conversations/services/cart.service');
      const dbCart = await innerCartService.getActiveCart(restaurantId, customerPhone);
      const hasActiveCart = dbCart && ['active', 'checkout_pending', 'payment_pending'].includes(dbCart.status) && dbCart.items.length > 0;

      // Handle active recovery selection
      if (session.state === ConversationState.AWAITING_RECOVERY && dbCart) {
        const cleanText = text.toLowerCase().trim();
        if (cleanText === '1' || cleanText.includes('continue')) {
          // Restore Cart to session & continue fresh conversation around it
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
            event: { name: 'CONFIRM_PROFILE' } // Transitions FSM to AWAITING_ITEM
          }));
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async (currentSession) => {
            currentSession.cart.items = dbCart.items;
            return {
              event: { name: 'ADD_MORE', payload: {} }
            };
          });
          await this.messages.sendText(restaurantId, customerPhone, '✅ Cart restored! You can reply "checkout" or choose items from the menu.');
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'home' });
          return;
        } else if (cleanText === '2' || cleanText.includes('start new') || cleanText.includes('new order')) {
          // Mark old cart as abandoned, reset session, create new active cart
          await innerCartService.abandonCart(dbCart.id);
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
            event: { name: 'RESET' }
          }));
          await innerCartService.getOrCreateActiveCart(restaurantId, customerPhone);
          await this.messages.sendText(restaurantId, customerPhone, `Cart cleared! Let's start fresh Rahul 👋\n\nWhat would you like to order today?`);
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'home' });
          return;
        } else if (cleanText === '3' || cleanText.includes('view') || cleanText === 'cart') {
          // View Cart / Cart Recovery Dashboard (Part 5)
          const total = dbCart.items.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);
          let summaryText = '🛒 *Current Cart Items:*\n\n';
          dbCart.items.forEach((item: any, idx: number) => {
            summaryText += `${idx + 1}. Item (x${item.quantity}) — ₹${item.quantity * item.unitPrice}\n`;
          });
          summaryText += `\n*Grand Total: ₹${total}*\n\nChoose an action:\n1️⃣ *Continue Checkout*\n2️⃣ *Start New Order* (Clear Cart)`;
          await this.messages.sendText(restaurantId, customerPhone, summaryText);
          return;
        } else {
          await this.messages.sendText(restaurantId, customerPhone, 'Please reply:\n1️⃣ Continue Previous Order\n2️⃣ Start New Order\n3️⃣ View Cart');
          return;
        }
      }

      // Check if user is returning with an active cart
      if (session.state === ConversationState.IDLE && hasActiveCart && dbCart) {
        // Transition to recovery state via FSM (IDLE → AWAITING_RECOVERY)
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'START_RECOVERY' }
        }));

        const total = dbCart.items.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);
        const recoveryMsg = [
          `Welcome back ${customer.name || 'there'} 👋`,
          '',
          'You already have items in your cart:',
          ...dbCart.items.map((item: any) => `• ${item.quantity} × Item (₹${item.unitPrice} each)`),
          `*Grand Total:* ₹${total}`,
          '',
          'What would you like to do?',
          '1️⃣ *Continue Previous Order*',
          '2️⃣ *Start New Order*',
          '3️⃣ *View Cart*'
        ].join('\n');

        await this.messages.sendText(restaurantId, customerPhone, recoveryMsg);
        return;
      }

      // Smart Intent check: if direct message has ordering intent but cart is active
      if (directIntent && hasActiveCart && dbCart && (session.state as string) !== ConversationState.AWAITING_RECOVERY && (session.state as string) !== ConversationState.AWAITING_ITEM && (session.state as string) !== ConversationState.AWAITING_VARIANT && (session.state as string) !== ConversationState.AWAITING_QUANTITY) {
        // Transition to recovery state via FSM (IDLE → AWAITING_RECOVERY)
        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'START_RECOVERY' }
        }));

        const recoveryMsg = [
          `You already have an unfinished cart.`,
          '',
          'Would you like to:',
          '1️⃣ *Continue Previous Order*',
          '2️⃣ *Start a New Order*',
        ].join('\n');

        await this.messages.sendText(restaurantId, customerPhone, recoveryMsg);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 1 — Interactive Ordering Engine (primary ordering flow)
      // ─────────────────────────────────────────────────────────────────────
      const config = await this.whatsappConfigRepo.getByRestaurantId(restaurantId);
      logger.info({ mode: config.orderingMode }, 'Restaurant WhatsApp Ordering Mode');

      if (config.orderingMode !== 'ai_only') {
        // 1A. Direct Interactive Button/List Click
        if (payload.interactivePayload) {
          try {
            const parsedAction = JSON.parse(payload.interactivePayload);
            logger.info({ parsedAction }, '⚡ Interactive button/list click — routing to Interactive Engine');
            await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, parsedAction);
            return;
          } catch (err) {
            logger.warn({ err, payload: payload.interactivePayload }, 'Failed to parse interactive payload, falling back');
          }
        }

        // 1B. Text matches last interactive screen numbered option
        const matchedScreenOption = await interactiveOrderingService.matchTextToInteractiveOption(restaurantId, customerPhone, text);
        if (matchedScreenOption) {
          logger.info({ matchedScreenOption }, '🎯 Text matched active screen option — routing to Interactive Engine');
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, matchedScreenOption);
          return;
        }

        // 1C. Ordering intent detected from free text — send to Interactive Engine
        const orderingPayload = classifyOrderingIntent(text);
        if (orderingPayload) {
          logger.info({ orderingPayload, text }, '🛒 Ordering intent detected — routing to Interactive Engine');
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, orderingPayload);
          return;
        }

        // 1D. Interactive-only mode: block all unmatched free text
        if (config.orderingMode === 'interactive_only') {
          await this.messages.sendText(
            restaurantId,
            customerPhone,
            '⚠️ Please select an option from the menu buttons/list below to continue ordering.'
          );
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'home' });
          return;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 2 — Awaiting Variant (database-driven fast path)
      // ─────────────────────────────────────────────────────────────────────
      const availableMenu = await this.loadMenuWithVariants(restaurantId);
      logger.info({ menuItemsCount: availableMenu.length }, 'After loadMenuWithVariants');

      if (
        session.state === ConversationState.AWAITING_VARIANT &&
        session.context.pendingVariantItemId
      ) {
        const pendingItemId = session.context.pendingVariantItemId as string;
        const pendingItem = availableMenu.find(item => item.id === pendingItemId);
        const matchedVariant = pendingItem?.variants.find(
          v => v.variantName.toLowerCase() === text.toLowerCase()
        );

        if (matchedVariant) {
          const reply = await this.handleAwaitingVariant(
            restaurantId,
            customerPhone,
            text,
            session,
            availableMenu,
          );
          if (reply !== null) {
            await this.messages.sendText(restaurantId, customerPhone, reply);
            return;
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 3 — AI Employee (conversational: FAQ, recommendations, custom)
      // ─────────────────────────────────────────────────────────────────────
      const employeeStart = Date.now();
      const reply = await aiEmployeeService.handleMessage(restaurantId, customerPhone, text);

      logger.info({
        incomingMessage: text,
        aiEmployeeUsed: true,
        executionTimeMs: Date.now() - employeeStart,
      }, 'AI Employee V2 Message Processing Details');

        logger.debug({ reply }, 'Before sending reply');
        await this.messages.sendText(restaurantId, customerPhone, reply ?? 'Sorry, something went wrong.');
      });
    } catch (error) {
      logger.error(error, 'BOT REPLY SERVICE FAILED');
    }
  }

  // ─── AWAITING_VARIANT sub-handler ─────────────────────────────────────────

  private async handleAwaitingVariant(
    restaurantId: string,
    customerPhone: string,
    text: string,
    session: { context: Record<string, any> },
    availableMenu: MenuMappingItem[],
  ): Promise<string | null> {
    const pendingItemId = session.context.pendingVariantItemId as string;
    const pendingItem = availableMenu.find(item => item.id === pendingItemId);

    if (!pendingItem) return null;

    const matchedVariant = pendingItem.variants.find(
      v => v.variantName.toLowerCase() === text.toLowerCase()
    );

    if (matchedVariant) {
      const quantity = (session.context.pendingQuantity as number) ?? 1;

      await this.sessionService.executeSessionAction(
        restaurantId,
        customerPhone,
        async () => ({
          event: {
            name: 'CHOOSE_VARIANT',
            payload: {
              variantId: matchedVariant.id,
              unitPrice: matchedVariant.price,
            },
          },
        }),
      );

      await this.sessionService.executeSessionAction(
        restaurantId,
        customerPhone,
        async () => ({
          event: {
            name: 'SET_QUANTITY',
            payload: { quantity },
          },
        }),
      );

      const formattedName = getDisplayName({
        variantName: matchedVariant.variantName,
        itemName: pendingItem.name,
      });

      return `✅ Added ${quantity} x *${formattedName}* — ₹${matchedVariant.price} each.\n\nReply with "checkout" to confirm your order or add more items.`;
    }

    // Variant text not matched — re-prompt
    const variantReply = await this.variantHandler.handle(pendingItemId);
    if (variantReply) {
      return `I couldn't find "${text}". Please choose from:\n\n${variantReply}`;
    }

    return null;
  }

  // ─── Menu loader ──────────────────────────────────────────────────────────

  private async loadMenuWithVariants(restaurantId: string): Promise<MenuMappingItem[]> {
    const supabase = db.getClient();

    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, aliases, base_price')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true);

    if (menuError) {
      logger.error({ error: menuError, restaurantId }, 'Failed to load menu for bot');
      return [];
    }

    const rawItems = menuData || [];
    if (rawItems.length === 0) return [];

    const itemIds = rawItems.map((i: any) => i.id);

    const { data: variantsData, error: vError } = await supabase
      .from('menu_item_variants')
      .select('id, menu_item_id, variant_name, price')
      .in('menu_item_id', itemIds)
      .eq('is_available', true);

    if (vError) {
      logger.error({ error: vError, restaurantId }, 'Failed to load variants for bot');
    }

    const variantsByItemId = new Map<string, Array<{ id: string; variantName: string; price: number }>>();
    for (const v of (variantsData || []) as any[]) {
      if (!variantsByItemId.has(v.menu_item_id)) {
        variantsByItemId.set(v.menu_item_id, []);
      }
      variantsByItemId.get(v.menu_item_id)!.push({
        id: v.id,
        variantName: v.variant_name,
        price: Number(v.price),
      });
    }

    return rawItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      aliases: item.aliases || [],
      basePrice: item.base_price !== null && item.base_price !== undefined
        ? Number(item.base_price)
        : null,
      variants: variantsByItemId.get(item.id) || [],
    }));
  }
}
