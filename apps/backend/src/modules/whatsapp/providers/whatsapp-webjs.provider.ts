import { QueueName } from '../../../infrastructure/queue/types/queue.types';
import { queueRegistry } from '../../../infrastructure/queue';
import { redis } from '../../../infrastructure/redis/redis.client';
import { logger } from '../../../infrastructure/logger/logger';
import { execFileSync } from 'child_process';
import { existsSync, readdirSync, rmSync } from 'fs';
import path from 'path';
import {
  SendMessagePayload,
  WhatsAppProvider,
  WhatsAppSessionStatus,
} from './whatsapp-provider.types';

type WebJsClient = any;

interface RuntimeSession {
  restaurantId: string;
  client?: WebJsClient;
  status: WhatsAppSessionStatus;
  initializing: boolean;
  lastSendAt: number;
  resetAttempted: boolean;
  watchdog?: NodeJS.Timeout;
  readyPromise?: Promise<void>;
  resolveReady?: () => void;
  // Guards background restore from firing multiple times
  restoringFromRedis: boolean;
}

export class WhatsAppWebJsProvider implements WhatsAppProvider {
  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly sessionPath = process.env.WHATSAPP_SESSION_PATH || '.wwebjs_auth';
  private readonly minSendIntervalMs = Number(process.env.WHATSAPP_SEND_THROTTLE_MS || 900);

  // ─── Public API ────────────────────────────────────────────────────────────

  public async connectSession(restaurantId: string): Promise<WhatsAppSessionStatus> {
    const session = this.getOrCreateSession(restaurantId);

    // Already connected — nothing to do
    if (session.status.state === 'connected' && session.client) {
      return session.status;
    }

    // Already initializing — return current status and let events drive state
    if (session.initializing) {
      return session.status;
    }

    // Destroy any existing stale client before starting fresh
    await this.destroyClientSafely(session);

    await this.prepareAuthDirectory(restaurantId);
    session.readyPromise = new Promise<void>((resolve) => {
      session.resolveReady = resolve;
    });
    session.initializing = true;
    session.restoringFromRedis = false;
    session.resetAttempted = false;
    session.status = {
      restaurantId,
      state: 'reconnecting',
      lastError: undefined,
    };
    await this.persistStatus(session.status);

    this.spawnClient(session).catch((error) => {
      logger.error({ error, restaurantId }, 'WhatsApp connectSession spawn failed');
    });

    return session.status;
  }

  public async disconnectSession(restaurantId: string): Promise<WhatsAppSessionStatus> {
    const session = this.sessions.get(restaurantId);

    if (session) {
      this.clearWatchdog(session);
      await this.destroyClientSafely(session);
      this.sessions.delete(restaurantId);
    }

    // Kill any stale browser processes before wiping auth
    await this.cleanupStaleBrowsers(restaurantId);

    // Wipe full auth directory so next connect starts completely fresh
    await this.resetAuthDirectory(restaurantId);

    const disconnected: WhatsAppSessionStatus = {
      restaurantId,
      state: 'disconnected',
      lastDisconnectedAt: new Date().toISOString(),
    };
    await this.persistStatus(disconnected);
    logger.info({ restaurantId }, 'WhatsApp session destroyed');
    return disconnected;
  }

  public async sendMessage(payload: SendMessagePayload): Promise<void> {
    const session = await this.ensureConnected(payload.restaurantId);

    const waitMs = Math.max(0, this.minSendIntervalMs - (Date.now() - session.lastSendAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    session.lastSendAt = Date.now();
    await session.client.sendMessage(this.normalizeChatId(payload.to), payload.body);
  }

  public async getStatus(restaurantId: string): Promise<WhatsAppSessionStatus> {
    // If there's a live in-memory session, always trust it
    const session = this.sessions.get(restaurantId);
    if (session) return session.status;

    // No in-memory session — check Redis
    const persisted = await redis.getClient().get(this.statusKey(restaurantId));
    if (!persisted) {
      return { restaurantId, state: 'disconnected' };
    }

    const status = JSON.parse(persisted) as WhatsAppSessionStatus;

    // Only auto-restore if the previous session was active
    if (status.state === 'connected' || status.state === 'reconnecting') {
      // Create session entry with restore guard to prevent duplicate spawns
      const newSession = this.getOrCreateSession(restaurantId);
      if (!newSession.restoringFromRedis && !newSession.initializing) {
        newSession.restoringFromRedis = true;
        const restoring: WhatsAppSessionStatus = {
          ...status,
          state: 'reconnecting',
          qrCode: undefined,
          qrCodeDataUrl: undefined,
          lastError: 'Restoring WhatsApp session after restart',
        };
        newSession.status = restoring;
        await this.persistStatus(restoring);

        // Fire-and-forget background restore
        this.connectSession(restaurantId).catch((error) => {
          logger.error({ error, restaurantId }, 'Background WhatsApp session restore failed');
        });

        return restoring;
      }
      return newSession.status;
    }

    // If we have an expired QR in Redis but NO in-memory session,
    // the Puppeteer browser that generated that QR is DEAD.
    // Scanning it will result in "Try again later".
    // We must return disconnected so the frontend prompts the user to connect again.
    if (status.state === 'expired') {
      const disconnectedStatus: WhatsAppSessionStatus = {
        restaurantId,
        state: 'disconnected',
        lastError: 'Session interrupted by server restart. Please connect again.',
      };
      await this.persistStatus(disconnectedStatus);
      return disconnectedStatus;
    }

    return status;
  }

  // ─── Private: Client Lifecycle ─────────────────────────────────────────────

  private async spawnClient(session: RuntimeSession): Promise<void> {
    const { restaurantId } = session;
    const authPath = path.resolve(process.cwd(), this.sessionPath, `session-restaurant-${restaurantId}`);
    logger.info({ restaurantId, authPath, exists: existsSync(authPath) }, '[DIAGNOSTIC] spawnClient: Preparing to launch Chromium. LocalAuth exists check.');
    try {
      const { Client, LocalAuth } = await this.loadWebJs();
      logger.info({ restaurantId, authPath }, '[DIAGNOSTIC] spawnClient: LocalAuth strategy created.');
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `restaurant-${restaurantId}`,
          dataPath: this.sessionPath,
        }),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        },
      });

      session.client = client;
      this.bindClientEvents(session, client);
      this.scheduleConnectWatchdog(session);
      logger.info({ restaurantId }, '[DIAGNOSTIC] spawnClient: WhatsApp client created, calling client.initialize()...');
      await client.initialize();
      logger.info({ restaurantId }, '[DIAGNOSTIC] spawnClient: WhatsApp client.initialize() returned successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger.warn({ restaurantId, error: errorMessage, stack }, '[DIAGNOSTIC] spawnClient: WhatsApp client spawn failed, attempting recovery');

      if (this.isBrowserAlreadyRunningError(errorMessage)) {
        await this.cleanupStaleBrowsers(restaurantId);
        await this.prepareAuthDirectory(restaurantId);
        // Retry once after cleanup
        try {
          const { Client, LocalAuth } = await this.loadWebJs();
          const retryClient = new Client({
            authStrategy: new LocalAuth({
              clientId: `restaurant-${restaurantId}`,
              dataPath: this.sessionPath,
            }),
            puppeteer: {
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            },
          });

          session.client = retryClient;
          this.bindClientEvents(session, retryClient);
          this.scheduleConnectWatchdog(session);
          logger.info({ restaurantId }, 'WhatsApp client retry after cleanup, initializing...');
          await retryClient.initialize();
          return;
        } catch (retryError) {
          const retryMsg = retryError instanceof Error ? retryError.message : String(retryError);
          session.initializing = false;
          session.status = {
            restaurantId,
            state: 'disconnected',
            lastError: retryMsg,
          };
          await this.persistStatus(session.status);
          this.resolveReady(session);
          logger.error({ restaurantId, error: retryMsg }, 'WhatsApp client retry failed');
          return;
        }
      }

      session.initializing = false;
      session.status = {
        restaurantId,
        state: 'disconnected',
        lastError: errorMessage,
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
      logger.error({ restaurantId, error: errorMessage }, 'WhatsApp client failed to initialize');
    }
  }

  private async destroyClientSafely(session: RuntimeSession, reason?: string): Promise<void> {
    if (!session.client) return;
    try {
      logger.info({ restaurantId: session.restaurantId, reason }, '[DIAGNOSTIC] destroyClientSafely: WHO called destroy() and WHY');
      await session.client.destroy();
      logger.info({ restaurantId: session.restaurantId }, '[DIAGNOSTIC] destroyClientSafely: WhatsApp client destroyed successfully');
    } catch (error) {
      const stack = error instanceof Error ? error.stack : undefined;
      logger.warn({ error, stack, restaurantId: session.restaurantId }, '[DIAGNOSTIC] destroyClientSafely: WhatsApp client destroy failed (ignored)');
    } finally {
      session.client = undefined;
    }
  }

  private bindClientEvents(session: RuntimeSession, client: WebJsClient): void {
    client.on('qr', async (qr: string) => {
      logger.info({ restaurantId: session.restaurantId }, '[DIAGNOSTIC] EVENT: qr - WhatsApp QR generated');
      session.initializing = false;
      this.clearWatchdog(session);
      session.status = {
        restaurantId: session.restaurantId,
        state: 'expired',
        qrCode: qr,
        qrCodeDataUrl: await this.qrToDataUrl(qr),
      };
      await this.persistStatus(session.status);
      // Schedule watchdog so a never-scanned QR eventually resets
      this.scheduleQrWatchdog(session);
    });

    client.on('authenticated', async (sessionData: any) => {
      logger.info({ restaurantId: session.restaurantId, sessionData }, '[DIAGNOSTIC] EVENT: authenticated - WhatsApp QR scanned');
      this.clearWatchdog(session);
      // Clear QR explicitly — signals to frontend that scan happened
      session.status = {
        restaurantId: session.restaurantId,
        state: 'reconnecting',
        qrCode: undefined,
        qrCodeDataUrl: undefined,
        lastError: undefined,
      };
      await this.persistStatus(session.status);
    });

    client.on('ready', async () => {
      logger.info({ restaurantId: session.restaurantId, phone: client.info?.wid?.user }, '[DIAGNOSTIC] EVENT: ready - WhatsApp session READY');
      session.initializing = false;
      session.resetAttempted = false;
      this.clearWatchdog(session);
      session.status = {
        restaurantId: session.restaurantId,
        state: 'connected',
        connectedPhone: client.info?.wid?.user,
        lastConnectedAt: new Date().toISOString(),
        qrCode: undefined,
        qrCodeDataUrl: undefined,
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
    });

    client.on('auth_failure', async (message: string) => {
      logger.error({ restaurantId: session.restaurantId, message }, '[DIAGNOSTIC] EVENT: auth_failure - WhatsApp auth failure');
      session.initializing = false;
      this.clearWatchdog(session);
      // Reset auth directory so next connect gets a fresh QR
      await this.resetAuthDirectory(session.restaurantId);
      session.status = {
        restaurantId: session.restaurantId,
        state: 'disconnected',
        qrCode: undefined,
        qrCodeDataUrl: undefined,
        lastError: `Auth failed: ${message}`,
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
    });

    client.on('disconnected', async (reason: string) => {
      logger.warn({ restaurantId: session.restaurantId, reason }, '[DIAGNOSTIC] EVENT: disconnected - WhatsApp client disconnected');
      session.initializing = false;
      this.clearWatchdog(session);

      // NAVIGATION = WhatsApp internal reconnect; otherwise treat as clean disconnect
      const isInternalReconnect = reason === 'NAVIGATION';
      session.status = {
        restaurantId: session.restaurantId,
        state: 'disconnected',
        qrCode: undefined,
        qrCodeDataUrl: undefined,
        lastDisconnectedAt: new Date().toISOString(),
        lastError: reason,
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);

      if (isInternalReconnect) {
        logger.info({ restaurantId: session.restaurantId }, '[DIAGNOSTIC] WhatsApp internal NAVIGATION disconnect — auto-reconnecting in 3s');
        setTimeout(() => this.connectSession(session.restaurantId).catch(() => undefined), 3000);
      }
    });

    client.on('loading_screen', (percent: string, message: string) => {
      logger.info({ restaurantId: session.restaurantId, percent, message }, '[DIAGNOSTIC] EVENT: loading_screen');
    });

    client.on('change_state', (state: any) => {
      logger.info({ restaurantId: session.restaurantId, state }, '[DIAGNOSTIC] EVENT: change_state');
    });

    client.on('remote_session_saved', () => {
      logger.info({ restaurantId: session.restaurantId }, '[DIAGNOSTIC] EVENT: remote_session_saved');
    });

    client.on('message', async (message: any) => {
      logger.info(
        { restaurantId: session.restaurantId, from: message.from, fromMe: message.fromMe, messageId: message.id?._serialized },
        'WhatsApp message received'
      );
      await this.safeHandleIncomingMessage(session.restaurantId, message);
    });

    client.on('message_create', async (message: any) => {
      await this.safeHandleIncomingMessage(session.restaurantId, message);
    });
  }

  // ─── Private: Watchdogs ────────────────────────────────────────────────────

  private scheduleConnectWatchdog(session: RuntimeSession): void {
    this.clearWatchdog(session);
    // If no QR or ready event fires in 45s, attempt recovery
    session.watchdog = setTimeout(() => {
      this.recoverStuckSession(session).catch((error) => {
        logger.error({ error, restaurantId: session.restaurantId }, 'WhatsApp stuck session recovery failed');
      });
    }, 45000);
  }

  private scheduleQrWatchdog(session: RuntimeSession): void {
    this.clearWatchdog(session);
    // If QR is never scanned in 90s, reset to disconnected so user can retry
    session.watchdog = setTimeout(async () => {
      if (session.status.state !== 'expired') return;
      logger.warn({ restaurantId: session.restaurantId }, 'WhatsApp QR expired without scan — resetting');
      await this.destroyClientSafely(session);
      await this.cleanupStaleBrowsers(session.restaurantId);
      session.initializing = false;
      session.status = {
        restaurantId: session.restaurantId,
        state: 'disconnected',
        qrCode: undefined,
        qrCodeDataUrl: undefined,
        lastError: 'QR code expired. Click Connect to generate a new one.',
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
    }, 90000);
  }

  private clearWatchdog(session: RuntimeSession): void {
    if (session.watchdog) {
      clearTimeout(session.watchdog);
      session.watchdog = undefined;
    }
  }

  private async recoverStuckSession(session: RuntimeSession): Promise<void> {
    if (session.status.state === 'connected' || session.status.state === 'expired') {
      return;
    }

    logger.warn({ restaurantId: session.restaurantId, resetAttempted: session.resetAttempted }, 'WhatsApp session stuck — recovering');

    if (session.resetAttempted) {
      session.initializing = false;
      session.status = {
        restaurantId: session.restaurantId,
        state: 'disconnected',
        qrCode: undefined,
        qrCodeDataUrl: undefined,
        lastError: 'WhatsApp failed to initialize after two attempts. Click Connect to retry.',
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
      return;
    }

    session.resetAttempted = true;
    await this.destroyClientSafely(session);
    await this.cleanupStaleBrowsers(session.restaurantId);
    await this.resetAuthDirectory(session.restaurantId);
    session.initializing = false;
    session.status = {
      restaurantId: session.restaurantId,
      state: 'disconnected',
      qrCode: undefined,
      qrCodeDataUrl: undefined,
      lastError: 'Previous session was stale. Generating fresh QR.',
    };
    await this.persistStatus(session.status);
    // Immediately retry with a clean slate
    await this.connectSession(session.restaurantId);
  }

  // ─── Private: Connection helpers ───────────────────────────────────────────

  private getOrCreateSession(restaurantId: string): RuntimeSession {
    const existing = this.sessions.get(restaurantId);
    if (existing) return existing;

    const session: RuntimeSession = {
      restaurantId,
      initializing: false,
      lastSendAt: 0,
      resetAttempted: false,
      restoringFromRedis: false,
      status: { restaurantId, state: 'disconnected' },
    };
    this.sessions.set(restaurantId, session);
    return session;
  }

  private async ensureConnected(restaurantId: string): Promise<RuntimeSession> {
    const session = this.getOrCreateSession(restaurantId);
    if (session.status.state === 'connected' && session.client) return session;

    if (!session.initializing) {
      await this.connectSession(restaurantId);
    }

    await this.waitUntilReady(session, 20000);
    if (session.status.state !== 'connected' || !session.client) {
      throw new Error(`WhatsApp session is not connected for restaurant ${restaurantId}`);
    }
    return session;
  }

  private async waitUntilReady(session: RuntimeSession, timeoutMs: number): Promise<void> {
    if (session.status.state === 'connected' && session.client) return;
    if (!session.readyPromise) return;

    const timeout = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Timed out waiting for WhatsApp session to connect')), timeoutMs);
    });

    await Promise.race([session.readyPromise, timeout]);
  }

  private resolveReady(session: RuntimeSession): void {
    if (session.resolveReady) {
      session.resolveReady();
      session.resolveReady = undefined;
    }
    session.readyPromise = undefined;
  }

  // ─── Private: Message handling ─────────────────────────────────────────────

  private async safeHandleIncomingMessage(restaurantId: string, message: any): Promise<void> {
    try {
      await this.handleIncomingMessage(restaurantId, message);
    } catch (error) {
      logger.error(
        { error, restaurantId, from: message?.from, messageId: message?.id?._serialized || message?.id?.id },
        'Failed to enqueue incoming WhatsApp message'
      );
      await this.persistDebugEvent(restaurantId, {
        at: new Date().toISOString(),
        event: 'enqueue_failed',
        reason: error instanceof Error ? error.message : String(error),
        messageId: message?.id?._serialized || message?.id?.id || '',
        from: message?.from,
      });
    }
  }

  private async handleIncomingMessage(restaurantId: string, message: any): Promise<void> {
    const messageId = message.id?._serialized || message.id?.id || '';

    await this.persistDebugEvent(restaurantId, {
      at: new Date().toISOString(),
      event: 'incoming_candidate',
      messageId,
      from: message.from,
      to: message.to,
      fromMe: Boolean(message.fromMe),
      body: message.body || '',
      type: message.type,
    });

    if (!messageId) return;
    if (message.from === 'status@broadcast' || message.from?.endsWith('@broadcast')) return;
    if (message.fromMe) return;

    const dedupKey = `wwebjs:processed:${restaurantId}:${messageId}`;
    const inserted = await redis.getClient().set(dedupKey, 'true', 'EX', 86400, 'NX');
    if (!inserted) {
      logger.debug({ restaurantId, messageId }, 'Duplicate message — skipped');
      return;
    }

    const queue = queueRegistry.getQueue(QueueName.WHATSAPP_INCOMING);
    await queue.add(
      'incoming-message',
      {
        traceId: messageId,
        timestamp: new Date().toISOString(),
        platform: 'whatsapp',
        restaurantId,
        messageId,
        from: message.from,
        customerPhone: this.denormalizeChatId(message.from),
        textBody: message.body || '',
        content: { body: message.body || '', type: message.type },
      },
      { jobId: this.buildQueueJobId(restaurantId, messageId) }
    );
    logger.info({ restaurantId, messageId }, 'Message enqueued to BullMQ');

    await this.persistDebugEvent(restaurantId, {
      at: new Date().toISOString(),
      event: 'queued',
      messageId,
      from: message.from,
      customerPhone: this.denormalizeChatId(message.from),
    });
  }

  // ─── Private: Redis ────────────────────────────────────────────────────────

  private async persistStatus(status: WhatsAppSessionStatus): Promise<void> {
    await redis.getClient().set(this.statusKey(status.restaurantId), JSON.stringify(status), 'EX', 30 * 24 * 60 * 60);
  }

  private async persistDebugEvent(restaurantId: string, event: Record<string, unknown>): Promise<void> {
    const key = `whatsapp:session:${restaurantId}:debug`;
    await redis.getClient().lpush(key, JSON.stringify(event));
    await redis.getClient().ltrim(key, 0, 24);
    await redis.getClient().expire(key, 24 * 60 * 60);
  }

  private statusKey(restaurantId: string): string {
    return `whatsapp:session:${restaurantId}:status`;
  }

  // ─── Private: Filesystem ───────────────────────────────────────────────────

  private async prepareAuthDirectory(restaurantId: string): Promise<void> {
    const authDir = path.resolve(process.cwd(), this.sessionPath, `session-restaurant-${restaurantId}`);
    const lockFiles = ['LOCK', 'lockfile', 'DevToolsActivePort'];

    try {
      if (!existsSync(authDir)) return;

      const defaultDir = path.join(authDir, 'Default');
      for (const fileName of lockFiles) {
        const filePath = path.join(authDir, fileName);
        if (existsSync(filePath)) rmSync(filePath, { force: true });
      }

      if (existsSync(defaultDir)) {
        for (const entry of readdirSync(defaultDir)) {
          if (entry === 'LOCK' || entry.startsWith('Singleton') || entry === 'DevToolsActivePort') {
            rmSync(path.join(defaultDir, entry), { force: true, recursive: true });
          }
        }
      }
    } catch (error) {
      logger.warn({ error, restaurantId, authDir }, 'WhatsApp auth directory cleanup completed with warnings');
    }
  }

  private async resetAuthDirectory(restaurantId: string): Promise<void> {
    const authDir = path.resolve(process.cwd(), this.sessionPath, `session-restaurant-${restaurantId}`);
    try {
      if (existsSync(authDir)) {
        rmSync(authDir, { force: true, recursive: true });
        logger.info({ restaurantId, authDir }, 'WhatsApp auth directory wiped');
      }
    } catch (error) {
      logger.warn({ error, restaurantId, authDir }, 'WhatsApp auth directory reset completed with warnings');
    }
  }

  private async cleanupStaleBrowsers(restaurantId: string): Promise<void> {
    try {
      const script = [
        '$ErrorActionPreference = "SilentlyContinue";',
        `$pattern = '*wwebjs_auth*restaurant-${restaurantId}*';`,
        'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like $pattern } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
      ].join(' ');

      execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
    } catch (error) {
      logger.warn({ error, restaurantId }, 'WhatsApp browser cleanup attempt completed with warnings');
    }
  }

  // ─── Private: Utilities ────────────────────────────────────────────────────

  private async loadWebJs(): Promise<any> {
    const packageName = 'whatsapp-web.js';
    const module = await import(packageName);
    return {
      ...module.default,
      ...module,
      LocalAuth: module.LocalAuth || module.default?.LocalAuth,
      Client: module.Client || module.default?.Client,
    };
  }

  private async qrToDataUrl(qr: string): Promise<string | undefined> {
    try {
      const packageName = 'qrcode';
      const qrcode = await import(packageName);
      return await qrcode.toDataURL(qr, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
    } catch {
      return undefined;
    }
  }

  private isBrowserAlreadyRunningError(message: string): boolean {
    return /browser is already running|userDataDir|session-restaurant|LocalAuth is not a constructor/i.test(message);
  }

  private normalizeChatId(phoneOrChatId: string): string {
    if (phoneOrChatId.includes('@')) return phoneOrChatId;
    return `${phoneOrChatId.replace(/[^\d]/g, '')}@c.us`;
  }

  private denormalizeChatId(chatId: string): string {
    return chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
  }

  private buildQueueJobId(restaurantId: string, messageId: string): string {
    return `${restaurantId}-${messageId}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 180);
  }
}
