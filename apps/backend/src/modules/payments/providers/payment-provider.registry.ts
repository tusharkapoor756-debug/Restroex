import { IPaymentProvider } from './payment-provider.interface';
import { ManualUpiProvider } from './manual-upi.provider';
import { CodProvider } from './cod.provider';

// ============================================================
// PaymentProviderRegistry
//
// Central registry that maps payment_method strings to their
// provider implementations. To add a new gateway:
//   1. Implement IPaymentProvider in a new file
//   2. Add one line to this registry — nothing else changes.
// ============================================================
export class PaymentProviderRegistry {
  private static readonly providers: Map<string, IPaymentProvider> = new Map<string, IPaymentProvider>([
    ['manual_upi', new ManualUpiProvider()],
    ['cash', new CodProvider()],
    // Future providers — uncomment when APIs are implemented:
    // ['razorpay', new RazorpayProvider()],
    // ['phonepe', new PhonePeProvider()],
    // ['stripe', new StripeProvider()],
    // ['card', new CardProvider()],
  ]);

  public static get(paymentMethod: string): IPaymentProvider {
    const provider = this.providers.get(paymentMethod);
    if (!provider) {
      throw new Error(
        `No provider registered for payment method "${paymentMethod}". ` +
        `Available: ${[...this.providers.keys()].join(', ')}.`
      );
    }
    return provider;
  }

  public static has(paymentMethod: string): boolean {
    return this.providers.has(paymentMethod);
  }

  public static getSupportedMethods(): string[] {
    return [...this.providers.keys()];
  }
}
