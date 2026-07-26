import { IPaymentProvider } from './payment-provider.interface';
import { ManualUpiProvider } from './manual-upi.provider';
import { CodProvider } from './cod.provider';
import { UpiScreenshotProvider } from './upi-screenshot.provider';
import { RazorpayProvider } from './razorpay.provider';
import { CashfreeProvider } from './cashfree.provider';
import { PhonePeProvider } from './phonepe.provider';
import { PayUProvider } from './payu.provider';
import { EasebuzzProvider } from './easebuzz.provider';
import { StripeProvider } from './stripe.provider';

// ============================================================
// PaymentProviderRegistry
//
// Central registry mapping providerName / payment_method strings
// to their IPaymentProvider implementations.
// ============================================================
export class PaymentProviderRegistry {
  private static readonly providers: Map<string, IPaymentProvider> = new Map<string, IPaymentProvider>([
    ['upi_screenshot', new UpiScreenshotProvider()],
    ['manual_upi', new ManualUpiProvider()],
    ['cash', new CodProvider()],
    ['razorpay', new RazorpayProvider()],
    ['cashfree', new CashfreeProvider()],
    ['phonepe', new PhonePeProvider()],
    ['payu', new PayUProvider()],
    ['easebuzz', new EasebuzzProvider()],
    ['stripe', new StripeProvider()],
  ]);

  public static get(paymentMethod: string): IPaymentProvider {
    const provider = this.providers.get(paymentMethod);
    if (!provider) {
      throw new Error(
        `No provider registered for payment method/provider "${paymentMethod}". ` +
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

  public static getAllProviders(): IPaymentProvider[] {
    return [...this.providers.values()];
  }
}
