import { toolRegistry } from './tool-registry.service';
import { ToolContext } from '../types/tools.types';
import { logger } from '../../../infrastructure/logger/logger';

export class ToolDispatcher {
  /**
   * Dispatches a tool execution by name and passes context/arguments.
   * Ensures that unknown tools are handled gracefully.
   */
  public async dispatch(
    name: string,
    args: any,
    context: ToolContext
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    logger.info({ toolName: name, context, args }, 'ToolDispatcher: Dispatching tool execution');

    const tool = toolRegistry.getTool(name);
    if (!tool) {
      const errorMsg = `Tool not found: ${name}`;
      logger.error({ toolName: name }, errorMsg);
      return { success: false, error: errorMsg };
    }

    try {
      const result = await tool.execute(args, context);
      logger.info({ toolName: name, success: true }, 'ToolDispatcher: Tool execution completed successfully');
      return { success: true, result };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error during tool execution';
      logger.error({ toolName: name, error }, `ToolDispatcher: Tool execution failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}

export const toolDispatcher = new ToolDispatcher();
