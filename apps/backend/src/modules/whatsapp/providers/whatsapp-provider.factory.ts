import { WhatsAppProvider } from './whatsapp-provider.types';
import { WhatsAppWebJsProvider } from './whatsapp-webjs.provider';

class WhatsAppProviderFactory {
  private provider?: WhatsAppProvider;

  public getProvider(): WhatsAppProvider {
    if (!this.provider) {
      this.provider = new WhatsAppWebJsProvider();
    }
    return this.provider;
  }
}

export const whatsappProviderFactory = new WhatsAppProviderFactory();
