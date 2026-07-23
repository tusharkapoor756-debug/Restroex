import { Tool, ToolContext } from '../types/tools.types';
import { GetCartTool } from '../tools/get-cart.tool';
import { GetSessionTool } from '../tools/get-session.tool';
import { GetRecentHistoryTool } from '../tools/get-recent-history.tool';
import { AddItemToCartTool } from '../tools/add-item-to-cart.tool';
import { RemoveItemFromCartTool } from '../tools/remove-item-from-cart.tool';
import { UpdateCartQuantityTool } from '../tools/update-cart-quantity.tool';
import { ClearCartTool } from '../tools/clear-cart.tool';
import { GetMenuTool } from '../tools/get-menu.tool';
import { CheckoutTool } from '../tools/checkout-cart.tool';
import { logger } from '../../../infrastructure/logger/logger';

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    this.register(new GetCartTool());
    this.register(new GetSessionTool());
    this.register(new GetRecentHistoryTool());
    this.register(new AddItemToCartTool());
    this.register(new RemoveItemFromCartTool());
    this.register(new UpdateCartQuantityTool());
    this.register(new ClearCartTool());
    this.register(new GetMenuTool());
    this.register(new CheckoutTool());
  }

  public register(tool: Tool): void {
    if (this.tools.has(tool.definition.name)) {
      logger.warn(`Tool with name ${tool.definition.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.definition.name, tool);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  public getToolDefinitions(): any[] {
    return this.getAllTools().map((t) => t.definition);
  }
}

export const toolRegistry = new ToolRegistry();
