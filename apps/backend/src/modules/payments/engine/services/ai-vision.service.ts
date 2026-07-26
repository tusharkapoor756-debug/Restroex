import OpenAI from 'openai';
import { ExtractedPaymentDetails } from '../../types/payment-analysis.types';
import { logger } from '../../../../infrastructure/logger/logger';

export class AiVisionService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || 'fake-key',
    });
  }

  /**
   * Executes AI Vision as a second-opinion escalation path when Local OCR is inconclusive,
   * confidence is below threshold, or critical fields are missing.
   */
  public async extractDetailsWithVision(
    imageUrlOrBase64: string,
    reason: string
  ): Promise<ExtractedPaymentDetails | null> {
    logger.info({ reason }, '🤖 Escalating to AI Vision for payment screenshot analysis...');

    try {
      if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
        logger.warn('Skipping AI Vision call: No API key configured.');
        return null;
      }

      const prompt = `
Analyze this Indian payment screenshot (UPI / GPay / PhonePe / Paytm / BHIM / CRED / Bank App).
Extract the following fields accurately and return ONLY valid JSON:

{
  "amount": number or null,
  "currency": "INR",
  "upiReference": "12-digit UTR/RRN string" or null,
  "transactionId": string or null,
  "date": "DD/MM/YYYY" or null,
  "time": "HH:MM AM/PM" or null,
  "senderName": string or null,
  "receiverName": string or null,
  "receiverUpiId": "vpa@upi" or null,
  "bankName": string or null,
  "paymentApp": "Google Pay" | "PhonePe" | "Paytm" | "BHIM" | "CRED" | "Bank App" | null,
  "paymentStatusInScreenshot": "SUCCESS" | "PENDING" | "FAILED" | "UNKNOWN",
  "confidence": number between 0 and 100
}
`;

      const isBase64 = imageUrlOrBase64.startsWith('data:image');
      const imagePayload = isBase64
        ? { url: imageUrlOrBase64 }
        : { url: imageUrlOrBase64 };

      let modelName = process.env.AI_VISION_MODEL || 'openai/gpt-4o-mini';
      if (process.env.AI_MODEL && !process.env.AI_MODEL.includes('hy3')) {
        modelName = process.env.AI_MODEL;
      }

      const response = await this.client.chat.completions.create({
        model: modelName,
        max_tokens: 500,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: imagePayload },
            ] as any,
          },
        ],
      });

      const rawContent = response.choices[0]?.message?.content?.trim() ?? '';
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);

      const conf = typeof parsed.confidence === 'number' ? parsed.confidence : 85;

      return {
        amount: { value: parsed.amount ?? null, confidence: conf, source: 'ai_vision' },
        currency: { value: parsed.currency ?? 'INR', confidence: 95, source: 'ai_vision' },
        upiReference: { value: parsed.upiReference ?? null, confidence: conf, source: 'ai_vision' },
        transactionId: { value: parsed.transactionId ?? null, confidence: conf, source: 'ai_vision' },
        date: { value: parsed.date ?? null, confidence: conf, source: 'ai_vision' },
        time: { value: parsed.time ?? null, confidence: conf, source: 'ai_vision' },
        senderName: { value: parsed.senderName ?? null, confidence: conf, source: 'ai_vision' },
        receiverName: { value: parsed.receiverName ?? null, confidence: conf, source: 'ai_vision' },
        receiverUpiId: { value: parsed.receiverUpiId ?? null, confidence: conf, source: 'ai_vision' },
        bankName: { value: parsed.bankName ?? null, confidence: conf, source: 'ai_vision' },
        paymentApp: { value: parsed.paymentApp ?? null, confidence: conf, source: 'ai_vision' },
        paymentStatusInScreenshot: {
          value: parsed.paymentStatusInScreenshot ?? 'UNKNOWN',
          confidence: conf,
          source: 'ai_vision',
        },
        overallConfidence: conf,
      };
    } catch (err) {
      logger.error({ err }, '❌ AI Vision extraction failed');
      return null;
    }
  }
}
