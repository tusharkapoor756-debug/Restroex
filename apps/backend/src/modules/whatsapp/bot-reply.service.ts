import { SessionService } from '../conversations/session.service';
import { SessionRepository } from '../conversations/repositories/session.repository';
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
  private readonly sessionRepository: SessionRepository;
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
    this.sessionRepository = new SessionRepository();
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
        // ── PART 3 — STORE STATUS GATE ───────────────────────────────────────
        // Executes BEFORE conversation, FSM, AI, Cart or Checkout starts.
        const settingsRepo = new (require('../restaurants/repositories/settings.repository').SettingsRepository)();
        const settingsData = await settingsRepo.getSettings(restaurantId);
        const settings = settingsData?.settings;

        logger.info(
          { restaurantId, customerPhone, isOpen: settings?.isOpen, rawSettings: settings },
          '🔍 [Store Status Gatekeeper] Evaluated restaurant store status'
        );

        if (settings && settings.isOpen === false) {
          logger.info({ restaurantId, customerPhone }, '⛔ [Store Status Gatekeeper] Store is closed (isOpen === false). Halting pipeline immediately.');
          await this.messages.sendText(
            restaurantId,
            customerPhone,
            "We're currently closed. Please visit us during our opening hours."
          );
          logger.info({ restaurantId, customerPhone }, '🛑 [Store Status Gatekeeper] Pipeline halted. Early return executed.');
          return; // Stop pipeline immediately. Do NOT continue to FSM, AI, Cart, Checkout.
        } else {
          logger.info({ restaurantId, customerPhone, isOpen: settings?.isOpen }, '✅ [Store Status Gatekeeper] Store is OPEN. Proceeding to pipeline.');
        }

        // ── PART 4 — CAPACITY GATE ───────────────────────────────────────────
        // REVISION 1: Only count orders with statuses: received, accepted, preparing.
        // Excludes checkout_pending, payment_pending, paid, ready, completed, cancelled.
        const orderRepo = new (require('../orders/repositories/order.repository').OrderRepository)();
        const activeKitchenOrdersCount = await orderRepo.getActiveKitchenOrdersCount(restaurantId);
        const maxActiveCapacity = settings?.maxActiveOrders ?? 20;

        if (activeKitchenOrdersCount >= maxActiveCapacity) {
          logger.info(
            { restaurantId, customerPhone, activeKitchenOrdersCount, maxActiveCapacity },
            '⛔ Capacity Gate: High active kitchen workload. Halting pipeline.'
          );
          await this.messages.sendText(
            restaurantId,
            customerPhone,
            "We're currently experiencing a high number of orders. Please try again after some time."
          );
          return; // Stop pipeline immediately.
        }

        // ── Memory: persist inbound user message (fire-and-forget) ───────────
        conversationMemoryService.saveMessage(restaurantId, customerPhone, 'user', text).catch(() => undefined);

        let session = await this.sessionService.getSession(restaurantId, customerPhone);

        // ── REVISION 4 — SESSION CONFIGURATION FREEZE ───────────────────────
        // Lock restaurant settings snapshots into session context at conversation start
        // so ongoing conversations are never corrupted when owner modifies store settings mid-flow.
        if (session.state === ConversationState.IDLE || !session.context?.snapshotSupportedOrderModes) {
          const modesSnapshot = settings?.supportedOrderModes || ['takeaway', 'dining'];
          const tablesSnapshot = settings?.totalTables || 25;
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async (sess) => {
            return {
              event: {
                name: 'ADD_MORE', // Maintains state while mutating context
              },
              callback: async (s) => {
                s.context.snapshotSupportedOrderModes = modesSnapshot;
                s.context.snapshotTotalTables = tablesSnapshot;
              },
            };
          });
          session = await this.sessionService.getSession(restaurantId, customerPhone);
        }
      
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
      // LAYER -0.5 — Human Takeover Management
      // ─────────────────────────────────────────────────────────────────────
      if (session.state === ConversationState.HUMAN_TAKEOVER) {
        // If customer explicitly clicks a menu/interactive button, resume automated bot flow
        if (payload.interactivePayload || (await interactiveOrderingService.matchTextToInteractiveOption(restaurantId, customerPhone, text))) {
          logger.info({ customerPhone }, 'Customer selected an ordering action. Resuming bot from HUMAN_TAKEOVER.');
          await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
            event: { name: 'RESET' }
          }));
          session = await this.sessionService.getSession(restaurantId, customerPhone);
        } else {
          // Keep human takeover active for free-form customer staff conversations
          logger.info({ customerPhone }, 'Human Takeover active — skipping automated bot response.');
          return;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // LAYER 0.1 — Greeting Early Interception
      // When session is IDLE and the customer sends a greeting, respond with
      // the online ordering link and stop immediately. The customer is expected
      // to order via the web platform. All post-order updates (paid, accepted,
      // preparing, ready) continue to be sent via WhatsApp by the event bus.
      // ─────────────────────────────────────────────────────────────────────
      const GREETING_KEYWORDS = new Set([
        'hi', 'hello', 'hey', 'namaste', 'namaskar', 'ram ram', 'jai shri krishna',
        'hanji', 'haan', 'yo', 'sup', 'start', 'menu',
        'good morning', 'good evening', 'good afternoon', 'good night',
        'helo', 'hii', 'hiii', 'hihi', 'hlw', 'hlo',
        'kya hal', 'kaise ho', 'order karna', 'order', 'order karo',
      ]);
      const normalizedText = text.toLowerCase().trim();
      const isGreeting = GREETING_KEYWORDS.has(normalizedText) ||
        GREETING_KEYWORDS.has(normalizedText.replace(/[!?.,]+$/, ''));

      if (isGreeting && session.state === ConversationState.IDLE) {
        logger.info({ customerPhone, text }, '👋 Greeting detected in IDLE state — sending ordering link and stopping.');

        // Fetch restaurant to get the name
        const restaurantForGreeting = await this.restaurantRepository.findById(restaurantId);
        const restaurantName = restaurantForGreeting?.name || 'Our Restaurant';

        // Pass customerPhone so it gets embedded in the URL → ordering page pre-fills it
        const greetingMsg = this.greetingHandler.handle(restaurantName, restaurantId, customerPhone);
        await this.messages.sendText(restaurantId, customerPhone, greetingMsg);
        return; // Stop here — customer should order via the web link
      }

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
      // LAYER 0.5 — Customer Conversation Check (Zero CRM Pollution)
      // Note: WhatsApp greetings DO NOT create CRM customers.
      // Customer profile & code (CUS-XXXXXX) are generated ONLY upon real checkout placement.
      // ─────────────────────────────────────────────────────────────────────

      // ── V1 OPERATIONS ENGINE — STATE HANDLERS (Order Modes & Table Validation) ──
      if (session.state === ConversationState.AWAITING_ORDER_MODE) {
        const cleanText = text.toLowerCase().trim();
        let selectedMode: 'takeaway' | 'dining' | undefined = undefined;

        if (cleanText === '1' || cleanText === 'dining' || cleanText.includes('dine')) {
          selectedMode = 'dining';
        } else if (cleanText === '2' || cleanText === 'takeaway' || cleanText.includes('pickup') || cleanText.includes('take')) {
          selectedMode = 'takeaway';
        }

        if (!selectedMode) {
          await this.messages.sendText(
            restaurantId,
            customerPhone,
            'Please choose how you would like your order:\n\n1️⃣ *Dining*\n2️⃣ *Takeaway*\n\nReply with *1* or *2*.'
          );
          return;
        }

        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'SELECT_ORDER_MODE', payload: { orderType: selectedMode } }
        }));

        // Trigger checkout again to advance to Table Number or Order Summary
        await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'checkout' });
        return;
      }

      if (session.state === ConversationState.AWAITING_TABLE_NUMBER) {
        // REVISION 3: Explicit integer validation between 1 and totalTables
        const totalTables = session.context.snapshotTotalTables || settings?.totalTables || 25;
        const cleanText = text.trim();
        const parsedTable = parseInt(cleanText, 10);
        const isValidInteger = /^\d+$/.test(cleanText) && !isNaN(parsedTable) && parsedTable >= 1 && parsedTable <= totalTables;

        if (!isValidInteger) {
          await this.messages.sendText(
            restaurantId,
            customerPhone,
            `Please enter a valid table number (between 1 and ${totalTables}).`
          );
          return;
        }

        await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
          event: { name: 'PROVIDE_TABLE_NUMBER', payload: { tableNumber: parsedTable } }
        }));

        // Advance checkout to final summary and payment
        await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'checkout' });
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
        await this.messages.sendText(restaurantId, customerPhone, 'Profile updated! Let\'s continue with your order.');
        await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'home' });
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
          `Welcome back there 👋`,
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

        // Persist recovery screen options map so pressing 1 or 2 routes cleanly to checkout or cart clear
        await this.sessionRepository.patchContext(restaurantId, customerPhone, {
          lastInteractiveScreen: {
            id: 'recovery_prompt',
            options: [
              { key: '1', payload: { a: 'checkout' } },
              { key: 'continue previous order', payload: { a: 'checkout' } },
              { key: '2', payload: { a: 'cart_clear' } },
              { key: 'start a new order', payload: { a: 'cart_clear' } },
            ],
          },
        });

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

        // 1D. Interactive-only mode / unmatched text: show validation & re-render active screen
        if (config.orderingMode === 'interactive_only') {
          const latestSession = await this.sessionService.getSession(restaurantId, customerPhone);
          const lastScreen = latestSession.context.lastInteractiveScreen;

          // ── FREE-TEXT INPUT SCREENS ─────────────────────────────────────────
          // table_number_prompt and order_mode_selection accept plain numeric
          // input. These MUST NOT be trapped by the "Invalid choice" handler.
          // Inline handling here acts as a safety net even if the DB-mapped state
          // hasn't reconstructed via mapToDomain (e.g. first deployment).
          if (lastScreen?.id === 'table_number_prompt') {
            const totalTables = latestSession.context.snapshotTotalTables || settings?.totalTables || 25;
            const cleanText = text.trim();
            const parsedTable = parseInt(cleanText, 10);
            const isValidInteger = /^\d+$/.test(cleanText) && !isNaN(parsedTable) && parsedTable >= 1 && parsedTable <= totalTables;

            if (!isValidInteger) {
              await this.messages.sendText(
                restaurantId,
                customerPhone,
                `Please enter a valid table number between 1 and ${totalTables}.`
              );
              return;
            }

            await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
              event: { name: 'PROVIDE_TABLE_NUMBER', payload: { tableNumber: parsedTable } }
            }));
            await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'checkout' });
            return;
          }

          if (lastScreen?.id === 'order_mode_selection') {
            const cleanText = text.toLowerCase().trim();
            const supportedModes: string[] = latestSession.context?.snapshotSupportedOrderModes || ['dining', 'takeaway'];
            const modeByIndex = supportedModes[parseInt(cleanText, 10) - 1];
            const modeByName = supportedModes.find(m => m.toLowerCase() === cleanText || cleanText.includes(m));
            const selectedMode = modeByIndex || modeByName;

            if (!selectedMode) {
              const optionLines = supportedModes.map((m, i) => `${i + 1}️⃣ *${m.charAt(0).toUpperCase() + m.slice(1)}*`).join('\n');
              await this.messages.sendText(
                restaurantId,
                customerPhone,
                `Please choose a valid order mode:\n\n${optionLines}\n\nReply with the number.`
              );
              return;
            }

            await this.sessionService.executeSessionAction(restaurantId, customerPhone, async () => ({
              event: { name: 'SELECT_ORDER_MODE', payload: { orderType: selectedMode } }
            }));
            await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, { a: 'checkout' });
            return;
          }

          // Non-free-text screen: show "Invalid choice" and re-render
          const currentPayload = lastScreen?.options?.[0]?.payload || { a: 'home' };
          await this.messages.sendText(
            restaurantId,
            customerPhone,
            '⚠️ *Invalid choice.* Please select one of the numbered options below.'
          );
          await interactiveOrderingService.handleInteractiveClick(restaurantId, customerPhone, currentPayload);
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
