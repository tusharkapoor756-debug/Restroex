/**
 * @restroex/database Package Entry
 * 
 * Exports database table naming constants and shared type definitions
 * to maintain type-safety across backend services and background workers.
 */

export const DB_TABLES = {
  RESTAURANTS: 'restaurants',
  USERS: 'users',
  MENU_ITEMS: 'menu_items',
  CONVERSATION_SESSIONS: 'conversation_sessions',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  PAYMENTS: 'payments',
  AUDIT_LOGS: 'audit_logs',
} as const;

export type DBTableName = typeof DB_TABLES[keyof typeof DB_TABLES];

export interface DatabaseConnectionConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}
