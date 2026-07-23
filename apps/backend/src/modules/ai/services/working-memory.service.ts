// ─── Working Memory Types ─────────────────────────────────────────────────────

export type ConversationStage =
  | 'GREETING'
  | 'MENU_BROWSING'
  | 'ORDERING'
  | 'AWAITING_VARIANT'
  | 'AWAITING_CONFIRMATION'
  | 'CHECKOUT'
  | 'PAYMENT';

export interface WorkingMemory {
  conversationStage: ConversationStage;
  // Current customer goal expressed as intent
  currentGoal?: string;
  // Current resolved intent name
  currentIntent?: string;
  // Item pending variant selection
  pendingItem?: string;
  // The question the AI last asked the customer
  pendingQuestion?: string;
  // Last item discussed or added
  lastReferencedItem?: string;
  // Last variant discussed or added
  lastReferencedVariant?: string;
  // Tool name that was last executed
  lastAction?: string;
  // Cart version counter for cheap dirty-check
  cartVersion: number;
  // Compact rolling summary of the conversation (<= 100 tokens)
  rollingSummary?: string;
  // Millisecond timestamp of last update
  updatedAt: number;
}

// ─── Provider Interface ───────────────────────────────────────────────────────

export interface IWorkingMemoryProvider {
  get(restaurantId: string, customerPhone: string): Promise<WorkingMemory>;
  update(
    restaurantId: string,
    customerPhone: string,
    patch: Partial<Omit<WorkingMemory, 'updatedAt'>>,
  ): Promise<WorkingMemory>;
  reset(restaurantId: string, customerPhone: string): Promise<void>;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const DEFAULT_STAGE: ConversationStage = 'GREETING';
const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes

function freshMemory(): WorkingMemory {
  return {
    conversationStage: DEFAULT_STAGE,
    cartVersion: 0,
    updatedAt: Date.now(),
  };
}

// ─── In-Memory Provider (development / Redis fallback) ────────────────────────

export class InMemoryWorkingMemoryProvider implements IWorkingMemoryProvider {
  private readonly store = new Map<string, WorkingMemory>();

  private key(r: string, p: string) { return `${r}:${p}`; }

  async get(restaurantId: string, customerPhone: string): Promise<WorkingMemory> {
    const k = this.key(restaurantId, customerPhone);
    const existing = this.store.get(k);
    if (existing) {
      if (Date.now() - existing.updatedAt > SESSION_TTL_SECONDS * 1000) {
        this.store.delete(k);
        return this.init(restaurantId, customerPhone);
      }
      return existing;
    }
    return this.init(restaurantId, customerPhone);
  }

  async update(
    restaurantId: string,
    customerPhone: string,
    patch: Partial<Omit<WorkingMemory, 'updatedAt'>>,
  ): Promise<WorkingMemory> {
    const current = await this.get(restaurantId, customerPhone);
    const updated: WorkingMemory = { ...current, ...patch, updatedAt: Date.now() };
    this.store.set(this.key(restaurantId, customerPhone), updated);
    return updated;
  }

  async reset(restaurantId: string, customerPhone: string): Promise<void> {
    this.store.set(this.key(restaurantId, customerPhone), freshMemory());
  }

  private init(restaurantId: string, customerPhone: string): WorkingMemory {
    const mem = freshMemory();
    this.store.set(this.key(restaurantId, customerPhone), mem);
    return mem;
  }
}

// ─── Redis Provider (production) ──────────────────────────────────────────────

export class RedisWorkingMemoryProvider implements IWorkingMemoryProvider {
  private readonly redis: import('ioredis').Redis;
  private readonly prefix = 'wm:';

  constructor(redisClient: import('ioredis').Redis) {
    this.redis = redisClient;
  }

  private key(r: string, p: string) { return `${this.prefix}${r}:${p}`; }

  async get(restaurantId: string, customerPhone: string): Promise<WorkingMemory> {
    const raw = await this.redis.get(this.key(restaurantId, customerPhone));
    if (!raw) return freshMemory();
    try {
      return JSON.parse(raw) as WorkingMemory;
    } catch {
      return freshMemory();
    }
  }

  async update(
    restaurantId: string,
    customerPhone: string,
    patch: Partial<Omit<WorkingMemory, 'updatedAt'>>,
  ): Promise<WorkingMemory> {
    const current = await this.get(restaurantId, customerPhone);
    const updated: WorkingMemory = { ...current, ...patch, updatedAt: Date.now() };
    await this.redis.setex(
      this.key(restaurantId, customerPhone),
      SESSION_TTL_SECONDS,
      JSON.stringify(updated),
    );
    return updated;
  }

  async reset(restaurantId: string, customerPhone: string): Promise<void> {
    await this.redis.setex(
      this.key(restaurantId, customerPhone),
      SESSION_TTL_SECONDS,
      JSON.stringify(freshMemory()),
    );
  }
}

// ─── Factory: pick provider based on env, with InMemory fallback ──────────────

import { logger } from '../../../infrastructure/logger/logger';

function buildProvider(): IWorkingMemoryProvider {
  if (process.env.NODE_ENV === 'production' || process.env.WORKING_MEMORY_REDIS === 'true') {
    try {
      // Lazy-require to avoid boot failures when Redis is not needed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { redis } = require('../../../infrastructure/redis/redis.client');
      const client = redis.getClient();
      logger.info('WorkingMemory: using Redis provider');
      return new RedisWorkingMemoryProvider(client);
    } catch (err) {
      logger.warn({ err }, 'WorkingMemory: Redis unavailable, falling back to InMemory provider');
      return new InMemoryWorkingMemoryProvider();
    }
  }
  logger.info('WorkingMemory: using InMemory provider (development)');
  return new InMemoryWorkingMemoryProvider();
}

// ─── Singleton provider export ────────────────────────────────────────────────

export const workingMemoryProvider: IWorkingMemoryProvider = buildProvider();
