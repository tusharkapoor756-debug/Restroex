// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — PRODUCTION HARDENING ENGINE ─────

import { logger } from '../../../../infrastructure/logger/logger';
import { ReceiptEngineContainer } from '../contracts/receipt-engine.container';
import { PaymentDecision } from '../types/foundation-types';

export interface TelemetryMetrics {
  totalExecutionTimeMs: number;
  stageTimings: Record<string, number>;
  memoryUsageMb: number;
  isFallbackExecuted: boolean;
}

export interface EngineHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptimeSeconds: number;
  components: {
    ontologyLoader: boolean;
    imageNormalizer: boolean;
    ocrEngine: boolean;
    layoutDetector: boolean;
    sectionClassifier: boolean;
    grammarEngine: boolean;
    merchantVerification: boolean;
    fraudEngine: boolean;
    decisionEngine: boolean;
  };
}

export class ProductionHardeningEngine {
  private static startTime: number = Date.now();
  private static rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * 1. Global Error Boundary & Safe Execution Wrapper.
   * Wraps pipeline execution to prevent process crashes, logging trace details and executing fallback.
   */
  public static async executeWithGlobalBoundary<T>(
    stageName: string,
    operation: () => Promise<T> | T,
    fallbackValue: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (err: any) {
      logger.error(
        {
          stageName,
          errorMessage: err?.message || String(err),
          stack: err?.stack,
        },
        '🚨 Global Error Boundary caught unhandled pipeline stage exception.'
      );
      return fallbackValue;
    }
  }

  /**
   * 2. Telemetry & Metrics Logger.
   * Collects latency metrics, stage execution timing breakdown, and memory statistics.
   */
  public static recordTelemetry(stageTimings: Record<string, number>, isFallback: boolean = false): TelemetryMetrics {
    const memory = process.memoryUsage();
    const memoryUsageMb = Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100;
    const totalExecutionTimeMs = Object.values(stageTimings).reduce((sum, t) => sum + t, 0);

    const telemetry: TelemetryMetrics = {
      totalExecutionTimeMs,
      stageTimings,
      memoryUsageMb,
      isFallbackExecuted: isFallback,
    };

    logger.info({ telemetry }, '📈 Telemetry & performance metrics recorded.');
    return telemetry;
  }

  /**
   * 3. Engine Health Check Diagnostic Endpoint.
   * Inspects DI Container readiness and component health.
   */
  public static getEngineHealthStatus(): EngineHealthStatus {
    const container = ReceiptEngineContainer.getInstance();
    const uptimeSeconds = Math.round((Date.now() - ProductionHardeningEngine.startTime) / 1000);

    const components = {
      ontologyLoader: !!container.getOntologyLoader(),
      imageNormalizer: !!container.getImageNormalizer(),
      ocrEngine: !!container.getOcrEngine(),
      layoutDetector: !!container.getLayoutDetector(),
      sectionClassifier: !!container.getSectionClassifier(),
      grammarEngine: !!container.getGrammarEngine(),
      merchantVerification: !!container.getMerchantVerificationEngine(),
      fraudEngine: !!container.getFraudEngine(),
      decisionEngine: !!container.getDecisionEngine(),
    };

    const healthyCount = Object.values(components).filter(Boolean).length;
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (healthyCount < 5) {
      status = 'UNHEALTHY';
    } else if (healthyCount < 9) {
      status = 'DEGRADED';
    }

    return {
      status,
      uptimeSeconds,
      components,
    };
  }

  /**
   * 4. Rate Limit Safeguards.
   * Enforces token bucket rate limiting per merchant / IP (e.g. max 100 requests per minute).
   */
  public static checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): { allowed: boolean; remaining: number } {
    const now = Date.now();
    let record = ProductionHardeningEngine.rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      ProductionHardeningEngine.rateLimitMap.set(key, record);
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (record.count >= maxRequests) {
      logger.warn({ key, count: record.count }, '⚠️ Rate limit threshold exceeded for merchant request.');
      return { allowed: false, remaining: 0 };
    }

    record.count++;
    return { allowed: true, remaining: maxRequests - record.count };
  }

  /**
   * 5. Graceful Degradation Fallback Handler.
   * Returns safe fallback PaymentDecision if high-order pipeline stages fail.
   */
  public static getGracefulFallbackDecision(reason: string): PaymentDecision {
    logger.warn({ reason }, '🛡️ Graceful Degradation Fallback triggered.');

    return {
      action: 'MANUAL_REVIEW',
      confidenceScore: 30,
      explanations: [
        'Payment routed to MANUAL REVIEW: Pipeline execution degraded gracefully due to unhandled extraction error.',
        `Fallback Reason: ${reason}`,
      ],
      evidence: {
        receipt: undefined,
        verification: undefined,
        fraud: undefined,
      },
    };
  }
}
