import { PaymentStateMachine } from '../state-machine/payment.state-machine';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';
import { PaymentHealthService } from '../services/payment-health.service';
import { RazorpayProvider } from '../providers/razorpay.provider';
import { CashfreeProvider } from '../providers/cashfree.provider';
import { PhonePeProvider } from '../providers/phonepe.provider';
import { StripeProvider } from '../providers/stripe.provider';

describe('Universal Payment Orchestration Engine Suite', () => {
  describe('1. Payment Provider Registry & Contract', () => {
    it('should have all 9 payment providers registered', () => {
      const providers = PaymentProviderRegistry.getSupportedMethods();
      expect(providers).toContain('razorpay');
      expect(providers).toContain('cashfree');
      expect(providers).toContain('phonepe');
      expect(providers).toContain('payu');
      expect(providers).toContain('easebuzz');
      expect(providers).toContain('stripe');
      expect(providers).toContain('manual_upi');
      expect(providers).toContain('upi_screenshot');
      expect(providers).toContain('cash');
    });

    it('should instantiate provider adapters correctly', () => {
      const rzp = PaymentProviderRegistry.get('razorpay');
      expect(rzp).toBeInstanceOf(RazorpayProvider);
      expect(rzp.getDisplayName()).toBe('Razorpay PG');

      const cf = PaymentProviderRegistry.get('cashfree');
      expect(cf).toBeInstanceOf(CashfreeProvider);

      const phonepe = PaymentProviderRegistry.get('phonepe');
      expect(phonepe).toBeInstanceOf(PhonePeProvider);

      const stripe = PaymentProviderRegistry.get('stripe');
      expect(stripe).toBeInstanceOf(StripeProvider);
    });
  });

  describe('2. Universal Payment State Machine', () => {
    it('should validate legal orchestration state transitions', () => {
      expect(PaymentStateMachine.isValidTransition('pending', 'link_sent')).toBe(true);
      expect(PaymentStateMachine.isValidTransition('link_sent', 'customer_opened')).toBe(true);
      expect(PaymentStateMachine.isValidTransition('customer_opened', 'processing')).toBe(true);
      expect(PaymentStateMachine.isValidTransition('processing', 'verified')).toBe(true);
    });

    it('should allow retries from failed, cancelled, or expired states', () => {
      expect(PaymentStateMachine.isValidTransition('failed', 'link_sent')).toBe(true);
      expect(PaymentStateMachine.isValidTransition('cancelled', 'link_sent')).toBe(true);
      expect(PaymentStateMachine.isValidTransition('expired', 'link_sent')).toBe(true);
    });

    it('should reject invalid terminal state transitions', () => {
      expect(PaymentStateMachine.isValidTransition('refunded', 'verified')).toBe(false);
    });
  });

  describe('3. Gateway Health Checks & Connection Diagnostics', () => {
    it('should return invalid_credentials status when API keys are missing', async () => {
      const healthService = new PaymentHealthService({
        getByRestaurantAndProvider: async () => null,
        getAllByRestaurant: async () => [],
        upsertConfig: async (restId: string, prov: string, payload: any) => ({
          id: 'test_1',
          restaurantId: restId,
          providerName: prov,
          isEnabled: payload.isEnabled ?? true,
          isSandbox: payload.isSandbox ?? true,
          credentials: payload.credentials ?? {},
          status: payload.status ?? 'not_connected',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      } as any);

      const result = await healthService.testGatewayConnection('rest_123', 'razorpay', {});
      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe('invalid_credentials');
    });

    it('should pass health check when valid credentials are provided', async () => {
      const healthService = new PaymentHealthService({
        getByRestaurantAndProvider: async () => null,
        getAllByRestaurant: async () => [],
        upsertConfig: async (restId: string, prov: string, payload: any) => ({
          id: 'test_1',
          restaurantId: restId,
          providerName: prov,
          isEnabled: payload.isEnabled ?? true,
          isSandbox: payload.isSandbox ?? true,
          credentials: payload.credentials ?? {},
          status: payload.status ?? 'connected',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      } as any);

      const result = await healthService.testGatewayConnection('rest_123', 'razorpay', {
        key_id: 'rzp_test_123456789',
        key_secret: 'secret_123456',
      });
      expect(result.isHealthy).toBe(true);
      expect(result.status).toBe('connected');
    });
  });

  describe('4. Payment Link Generation & Single-Order Retry Engine', () => {
    it('should generate payment link and update record cleanly', async () => {
      let savedPayment: any = null;

      const mockPaymentRepo: any = {
        getByOrderId: async () => null,
        createPayment: async (dto: any) => {
          savedPayment = { id: 'pay_100', ...dto, paymentStatus: 'pending', paymentAttempt: 1 };
          return savedPayment;
        },
        update: async (id: string, dto: any) => {
          savedPayment = { ...savedPayment, ...dto };
          return savedPayment;
        },
      };

      const mockConfigRepo: any = {
        getByRestaurantAndProvider: async () => ({
          id: 'cfg_1',
          restaurantId: 'rest_1',
          providerName: 'razorpay',
          isEnabled: true,
          isSandbox: true,
          credentials: { key_id: 'rzp_test_12345678', key_secret: 'sec_123' },
          status: 'connected',
          createdAt: '',
          updatedAt: '',
        }),
      };

      const orchestrator = new PaymentOrchestratorService(mockPaymentRepo, mockConfigRepo);
      const res = await orchestrator.createOrRetryPaymentLink({
        orderId: 'order_999',
        restaurantId: 'rest_1',
        customerPhone: '+919999999999',
        amount: 500,
        providerName: 'razorpay',
      });

      expect(res.paymentUrl).toContain('https://rzp.io/l/');
      expect(savedPayment.paymentStatus).toBe('link_sent');
      expect(savedPayment.orderId).toBe('order_999');
    });
  });
});
