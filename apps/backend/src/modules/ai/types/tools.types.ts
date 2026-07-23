// ─── Tool System Types ────────────────────────────────────────────────────────
//
// This file defines the types for the LLM Tool Registry.
//

export interface ToolContext {
  restaurantId: string;
  customerPhone: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface Tool<TArgs = any, TResult = any> {
  definition: ToolDefinition;
  execute(args: TArgs, context: ToolContext): Promise<TResult>;
}
