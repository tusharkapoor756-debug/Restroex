import { performance } from 'perf_hooks';
import { IValidationLayer, PipelineContext, LayerExecutionResult, ILogger } from './validation-layer.interface';
import { logger as defaultLogger } from '../../../../infrastructure/logger/logger';

export class ValidationPipelineRunner {
  private layers: IValidationLayer[] = [];
  private logger: ILogger;

  constructor(layers: IValidationLayer[] = [], loggerInstance?: ILogger) {
    this.layers = [...layers];
    this.logger = loggerInstance ?? defaultLogger;
  }

  /**
   * Registers a new validation layer into the pipeline.
   */
  public registerLayer(layer: IValidationLayer): void {
    this.layers.push(layer);
  }

  /**
   * Returns registered layers sorted by order priority (lowest order number first).
   */
  public getLayers(): readonly IValidationLayer[] {
    return this.getSortedLayers();
  }

  /**
   * Executes registered validation layers sequentially in order of priority,
   * providing error isolation, critical layer short-circuiting, and high-precision telemetry.
   */
  public async run(context: PipelineContext): Promise<{
    context: PipelineContext;
    layerResults: LayerExecutionResult[];
  }> {
    const layerResults: LayerExecutionResult[] = [];
    const sortedLayers = this.getSortedLayers();
    this.logger.info({ totalLayers: sortedLayers.length }, '⚡ Validation Pipeline started');

    for (const layer of sortedLayers) {
      if (context.shouldShortCircuit && context.config.enableShortCircuit) {
        this.logger.info(
          { layer: layer.name, reason: context.shortCircuitReason },
          '⚡ Pipeline short-circuited — skipping remaining validation layers.'
        );
        break;
      }

      const startTime = performance.now();
      try {
        const result = await layer.evaluate(context);
        const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
        result.durationMs = durationMs;

        context.timings[layer.name] = durationMs;
        layerResults.push(result);

        if (result.warnings && result.warnings.length > 0) {
          context.warnings.push(...result.warnings);
        }
        if (result.explanationChecks && result.explanationChecks.length > 0) {
          context.explanationChecks.push(...result.explanationChecks);
        }

        // Handle critical layer failure or explicit short-circuit flag
        if (result.shouldShortCircuit || (layer.isCritical && !result.passed)) {
          context.shouldShortCircuit = true;
          context.shortCircuitReason =
            result.shortCircuitReason ??
            `Critical validation layer ${layer.name} failed evaluation criteria.`;

          this.logger.warn(
            { layer: layer.name, isCritical: layer.isCritical, reason: context.shortCircuitReason },
            `🛑 Validation layer ${layer.name} triggered short-circuiting.`
          );
        }
      } catch (error: unknown) {
        const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logger.error(
          { layer: layer.name, isCritical: layer.isCritical, error: errorMessage },
          `❌ Exception in validation layer ${layer.name}`
        );

        const errorResult: LayerExecutionResult = {
          layerName: layer.name,
          passed: false,
          durationMs,
          error: errorMessage,
          explanationChecks: [
            {
              code: 'FORMAT_CHECK',
              passed: false,
              title: `Layer ${layer.name} Exception`,
              message: `Validation layer ${layer.name} encountered an internal error: ${errorMessage}`,
              severity: layer.isCritical ? 'critical' : 'warning',
            },
          ],
        };

        context.timings[layer.name] = durationMs;
        layerResults.push(errorResult);
        context.warnings.push(`Layer ${layer.name} error: ${errorMessage}`);

        // Safe Critical Layer Handling: Stop pipeline immediately if critical layer fails/throws
        if (layer.isCritical) {
          context.shouldShortCircuit = true;
          context.shortCircuitReason = `Critical layer ${layer.name} failed with error: ${errorMessage}`;
          this.logger.error(
            { layer: layer.name, reason: context.shortCircuitReason },
            `🚨 Critical layer ${layer.name} threw an unhandled exception — stopping pipeline execution.`
          );
        }
      }
    }

    return { context, layerResults };
  }

  /**
   * Sorts layers by order priority (lowest number first).
   * Preserves registration insertion order for layers without an order property or equal order.
   */
  private getSortedLayers(): IValidationLayer[] {
    return [...this.layers].sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }
}
