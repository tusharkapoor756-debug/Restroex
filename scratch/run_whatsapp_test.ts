import { WhatsAppBotReplyService } from '../apps/backend/src/modules/whatsapp/bot-reply.service';

(async () => {
  // Dummy Supabase env vars to satisfy init
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-key';

  const service = new WhatsAppBotReplyService();
  const payload = {
    restaurantId: 'test-restaurant',
    customerPhone: '1234567890',
    from: '1234567890@c.us',
    textBody: 'malai chap full 2',
  };

  await service.handleIncomingMessage(payload);
  console.log('--- Test completed ---');
})();
