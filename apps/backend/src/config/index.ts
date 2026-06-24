import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  whatsapp: {
    apiKey: process.env.WHATSAPP_API_KEY,
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  },
  ai: {
    openAiKey: process.env.OPENAI_API_KEY,
  }
};
