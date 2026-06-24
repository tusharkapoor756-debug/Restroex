import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { env } from '../../config/env';
import { logger } from '../logger/logger';

// Polyfill WebSocket for Node.js compatibility
if (typeof global.WebSocket === 'undefined') {
  (global as any).WebSocket = WebSocket;
}

export class DatabaseClient {
  private static instance: DatabaseClient;
  private client: SupabaseClient;
  private connectionStatus: 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';

  private constructor() {
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        websocket: WebSocket,
      },
    } as any);
  }

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  /**
   * Initializes the database infrastructure.
   * Performs a lightweight connectivity check to ensure the Supabase service is reachable
   * and the provided credentials (URL and Service Role Key) are valid.
   */
  public async connect(): Promise<void> {
    try {
      /**
       * Proper lightweight connectivity validation.
       * We perform a HEAD request to the Supabase REST endpoint.
       * This validates:
       * 1. Networking/Connectivity
       * 2. URL validity
       * 3. API Key (Service Role) validity
       * without needing to query a specific table or creating fake ones.
       */
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      });

      if (!response.ok) {
        this.connectionStatus = 'DISCONNECTED';
        throw new Error(`Supabase infrastructure unreachable (Status: ${response.status} ${response.statusText})`);
      }
      
      this.connectionStatus = 'CONNECTED';
      logger.info('✅ Database infrastructure initialized (Supabase REST connected)');
    } catch (error) {
      logger.error({ error }, '❌ Failed to initialize database infrastructure');
      throw error;
    }
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  public getConnectionStatus(): string {
    return this.connectionStatus;
  }
}

export const db = DatabaseClient.getInstance();
