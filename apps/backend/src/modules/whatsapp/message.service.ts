import { logger } from '../../infrastructure/logger/logger';
import { whatsappProviderFactory } from './providers/whatsapp-provider.factory';
import { conversationMemoryService } from '../ai/services/conversation-memory.service';

export class WhatsAppMessageService {
  public async sendText(restaurantId: string, to: string, body: string) {
    logger.info({ restaurantId, to }, 'WhatsAppMessageService.sendText entry');
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    await provider.sendMessage({ restaurantId, to, body });
    logger.info({ restaurantId, to }, 'WhatsAppMessageService.sendText after provider.sendMessage');
    // ── Memory: persist outbound assistant reply (fire-and-forget) ──
    conversationMemoryService.saveMessage(restaurantId, to, 'assistant', body).catch(() => undefined);
  }

  public async sendImage(restaurantId: string, to: string, mediaUrl: string, caption?: string) {
    logger.info({ restaurantId, to, mediaUrl }, 'WhatsAppMessageService.sendImage entry');
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    await provider.sendMessage({ restaurantId, to, body: caption || '', mediaUrl });
  }

  public async sendDocument(restaurantId: string, to: string, documentUrl: string, fileName?: string, caption?: string) {
    logger.info({ restaurantId, to, documentUrl, fileName }, 'WhatsAppMessageService.sendDocument entry');
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    await provider.sendMessage({ restaurantId, to, body: caption || '', documentUrl, fileName });
  }

  public async sendTemplate(restaurantId: string, to: string, templateName: string, components: any[]) {
    const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
    if (provider.providerType === 'cloud_api') {
      await provider.sendMessage({
        restaurantId,
        to,
        body: '',
        template: { name: templateName, components },
      });
    } else {
      const body = this.renderTemplateFallback(templateName, components);
      await provider.sendMessage({ restaurantId, to, body });
    }
  }

  private renderTemplateFallback(templateName: string, components: any[]): string {
    const componentText = components
      .map((component) => JSON.stringify(component))
      .join('\n');
    return componentText ? `${templateName}\n${componentText}` : templateName;
  }
}
