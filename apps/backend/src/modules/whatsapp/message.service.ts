import { logger } from '../../infrastructure/logger/logger';
import { whatsappProviderFactory } from './providers/whatsapp-provider.factory';

export class WhatsAppMessageService {
  private readonly provider = whatsappProviderFactory.getProvider();

  public async sendText(restaurantId: string, to: string, body: string) {
    logger.info({ restaurantId, to }, 'WhatsAppMessageService.sendText entry');
    await this.provider.sendMessage({ restaurantId, to, body });
    logger.info({ restaurantId, to }, 'WhatsAppMessageService.sendText after provider.sendMessage');
  }

  public async sendTemplate(restaurantId: string, to: string, templateName: string, components: any[]) {
    const body = this.renderTemplateFallback(templateName, components);
    await this.provider.sendMessage({ restaurantId, to, body });
  }

  private renderTemplateFallback(templateName: string, components: any[]): string {
    const componentText = components
      .map((component) => JSON.stringify(component))
      .join('\n');
    return componentText ? `${templateName}\n${componentText}` : templateName;
  }
}
