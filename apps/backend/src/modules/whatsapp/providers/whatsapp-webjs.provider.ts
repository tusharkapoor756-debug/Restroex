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
}

export class WhatsAppWebJsProvider implements WhatsAppProvider {
  private readonly sessions = new Map<string, RuntimeSession>();
  private readonly sessionPath = process.env.WHATSAPP_SESSION_PATH || '.wwebjs_auth';
  private readonly minSendIntervalMs = Number(process.env.WHATSAPP_SEND_THROTTLE_MS || 900);

  public async connectSession(restaurantId: string): Promise<WhatsAppSessionStatus> {
    const session = this.getOrCreateSession(restaurantId);
    if (session.status.state === 'connected' || session.initializing) {
      return session.status;
    }

    await this.prepareAuthDirectory(restaurantId);
    session.readyPromise = new Promise<void>((resolve) => {
      session.resolveReady = resolve;
    });
    session.initializing = true;
    session.status = {
      ...session.status,
      state: session.status.qrCode ? 'expired' : 'reconnecting',
      lastError: undefined,
    };

    try {
      const { Client, LocalAuth } = await this.loadWebJs();
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
      logger.info({ restaurantId }, 'BEFORE client.initialize');
      await client.initialize();
      logger.info({ restaurantId }, 'AFTER client.initialize');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.isBrowserAlreadyRunningError(errorMessage)) {
        logger.warn({ restaurantId, error: errorMessage }, 'Stale WhatsApp browser detected. Cleaning up and retrying once.');
        await this.cleanupStaleBrowsers(restaurantId);
        await this.prepareAuthDirectory(restaurantId);
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
          await retryClient.initialize();
          return session.status;
        } catch (retryError) {
          session.initializing = false;
          this.resolveReady(session);
          session.status = {
            ...session.status,
            state: 'disconnected',
            lastError: retryError instanceof Error ? retryError.message : 'Unable to initialize WhatsApp provider',
          };
          logger.error({ retryError, restaurantId }, 'Failed to initialize WhatsApp Web.js provider after cleanup retry');
          return session.status;
        }
      }

      session.initializing = false;
      this.resolveReady(session);
      session.status = {
        ...session.status,
        state: 'disconnected',
        lastError: errorMessage || 'Unable to initialize WhatsApp provider',
      };
      logger.error({ error, restaurantId }, 'Failed to initialize WhatsApp Web.js provider');
    }

    return session.status;
  }

  public async disconnectSession(restaurantId: string): Promise<WhatsAppSessionStatus> {
    const session = this.getOrCreateSession(restaurantId);

    if (session.client) {
      try {
        await session.client.destroy();
      } catch (error) {
        logger.warn({ error, restaurantId }, 'WhatsApp client destroy failed during disconnect');
      }
    }

    this.sessions.delete(restaurantId);
    await this.prepareAuthDirectory(restaurantId);

    const disconnected: WhatsAppSessionStatus = {
      restaurantId,
      state: 'disconnected',
      lastDisconnectedAt: new Date().toISOString(),
    };
    await this.persistStatus(disconnected);
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
    const session = this.sessions.get(restaurantId);
    if (session) return session.status;

    const persisted = await redis.getClient().get(this.statusKey(restaurantId));
    if (!persisted) {
      return {
        restaurantId,
        state: 'disconnected',
      };
    }

    const status = JSON.parse(persisted) as WhatsAppSessionStatus;

    if (status.state === 'connected' || status.state === 'reconnecting') {
      const reconnecting: WhatsAppSessionStatus = {
        ...status,
        state: 'reconnecting',
        lastError: 'Restoring WhatsApp runtime session',
      };
      await this.persistStatus(reconnecting);
      this.connectSession(restaurantId).catch((error) => {
        logger.error({ error, restaurantId }, 'Background WhatsApp session restore failed');
      });
      return reconnecting;
    }

    return status;
  }

  private getOrCreateSession(restaurantId: string): RuntimeSession {
    const existing = this.sessions.get(restaurantId);
    if (existing) return existing;

    const session: RuntimeSession = {
      restaurantId,
      initializing: false,
      lastSendAt: 0,
      resetAttempted: false,
      status: {
        restaurantId,
        state: 'disconnected',
      },
    };
    this.sessions.set(restaurantId, session);
    return session;
  }

  private async ensureConnected(restaurantId: string): Promise<RuntimeSession> {
    const session = this.getOrCreateSession(restaurantId);
    if (session.status.state === 'connected' && session.client) {
      return session;
    }

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

  private bindClientEvents(session: RuntimeSession, client: WebJsClient): void {
    client.on('qr', async (qr: string) => {
      logger.info({ restaurantId: session.restaurantId }, 'QR EVENT FIRED');
      session.initializing = false;
      this.clearWatchdog(session);
      session.status = {
        restaurantId: session.restaurantId,
        state: 'expired',
        qrCode: qr,
        qrCodeDataUrl: await this.qrToDataUrl(qr),
      };
      await this.persistStatus(session.status);
    });

    client.on('ready', async () => {
      session.initializing = false;
      session.resetAttempted = false;
      this.clearWatchdog(session);
      session.status = {
        restaurantId: session.restaurantId,
        state: 'connected',
        connectedPhone: client.info?.wid?.user,
        lastConnectedAt: new Date().toISOString(),
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
      logger.info({ restaurantId: session.restaurantId }, 'WhatsApp session connected');
    });

    client.on('authenticated', async () => {
      session.status = {
        ...session.status,
        state: 'reconnecting',
        lastError: undefined,
      };
      await this.persistStatus(session.status);
    });

    client.on('auth_failure', async (message: string) => {
      session.initializing = false;
      this.clearWatchdog(session);
      session.status = {
        restaurantId: session.restaurantId,
        state: 'expired',
        lastError: message,
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
    });

    client.on('disconnected', async (reason: string) => {
      session.initializing = false;
      this.clearWatchdog(session);
      session.status = {
        restaurantId: session.restaurantId,
        state: reason === 'NAVIGATION' ? 'reconnecting' : 'disconnected',
        lastDisconnectedAt: new Date().toISOString(),
        lastError: reason,
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);

      if (session.status.state === 'reconnecting') {
        setTimeout(() => this.connectSession(session.restaurantId).catch(() => undefined), 3000);
      }
    });

    client.on('message', async (message: any) => {
      logger.info(
        { restaurantId: session.restaurantId, from: message.from, fromMe: message.fromMe, messageId: message.id?._serialized, eventSource: 'message' },
        'WhatsApp message event received'
      );
      await this.safeHandleIncomingMessage(session.restaurantId, message);
    });

    client.on('message_create', async (message: any) => {
      logger.info(
        { restaurantId: session.restaurantId, from: message.from, fromMe: message.fromMe, messageId: message.id?._serialized, eventSource: 'message_create' },
        'WhatsApp message_create event received'
      );
      await this.safeHandleIncomingMessage(session.restaurantId, message);
    });
  }

  private async safeHandleIncomingMessage(restaurantId: string, message: any): Promise<void> {
    try {
      await this.handleIncomingMessage(restaurantId, message);
    } catch (error) {
      logger.error(
        {
          error,
          restaurantId,
          from: message?.from,
          messageId: message?.id?._serialized || message?.id?.id,
        },
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

    if (!messageId) {
      await this.persistDebugEvent(restaurantId, {
        at: new Date().toISOString(),
        event: 'ignored',
        reason: 'missing_message_id',
      });
      return;
    }

    if (message.from === 'status@broadcast' || message.from?.endsWith('@broadcast')) {
      await this.persistDebugEvent(restaurantId, {
        at: new Date().toISOString(),
        event: 'ignored',
        reason: 'broadcast_status',
        messageId,
      });
      return;
    }

    if (message.fromMe) {
      await this.persistDebugEvent(restaurantId, {
        at: new Date().toISOString(),
        event: 'ignored',
        reason: 'from_me',
        messageId,
        body: message.body || '',
      });
      return;
    }

    const dedupKey = `wwebjs:processed:${restaurantId}:${messageId}`;
    const inserted = await redis.getClient().set(dedupKey, 'true', 'EX', 86400, 'NX');
    if (!inserted) {
      logger.debug({ restaurantId, messageId }, 'Duplicate message detected, skipping');
      await this.persistDebugEvent(restaurantId, {
        at: new Date().toISOString(),
        event: 'ignored',
        reason: 'duplicate',
        messageId,
      });
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
        content: {
          body: message.body || '',
          type: message.type,
        },
      },
      {
        jobId: this.buildQueueJobId(restaurantId, messageId),
      }
    );
    logger.info({ restaurantId, messageId, jobId: this.buildQueueJobId(restaurantId, messageId) }, 'Message enqueued to BullMQ');

    await this.persistDebugEvent(restaurantId, {
      at: new Date().toISOString(),
      event: 'queued',
      messageId,
      from: message.from,
      customerPhone: this.denormalizeChatId(message.from),
    });
  }

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

  private normalizeChatId(phoneOrChatId: string): string {
    if (phoneOrChatId.includes('@')) return phoneOrChatId;
    return `${phoneOrChatId.replace(/[^\d]/g, '')}@c.us`;
  }

  private denormalizeChatId(chatId: string): string {
    return chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
  }

  private buildQueueJobId(restaurantId: string, messageId: string): string {
    return `${restaurantId}-${messageId}`
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 180);
  }

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
      return await qrcode.toDataURL(qr, {
        margin: 1,
        width: 320,
        errorCorrectionLevel: 'M',
      });
    } catch {
      return undefined;
    }
  }

  private isBrowserAlreadyRunningError(message: string): boolean {
    return /browser is already running|userDataDir|session-restaurant|LocalAuth is not a constructor/i.test(message);
  }

  private async cleanupStaleBrowsers(restaurantId: string): Promise<void> {
    try {
      const script = [
        '$ErrorActionPreference = \"SilentlyContinue\";',
        `$pattern = '*wwebjs_auth*restaurant-${restaurantId}*';`,
        'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like $pattern } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }',
      ].join(' ');

      execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
    } catch (error) {
      logger.warn({ error, restaurantId }, 'WhatsApp browser cleanup attempt completed with warnings');
    }
  }

  private scheduleConnectWatchdog(session: RuntimeSession): void {
    this.clearWatchdog(session);

    session.watchdog = setTimeout(() => {
      this.recoverStuckSession(session).catch((error) => {
        logger.error({ error, restaurantId: session.restaurantId }, 'WhatsApp stuck session recovery failed');
      });
    }, 25000);
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

    if (session.resetAttempted) {
      session.initializing = false;
      session.status = {
        ...session.status,
        state: 'disconnected',
        lastError: 'WhatsApp session did not become ready. Please click Connect WhatsApp again.',
      };
      await this.persistStatus(session.status);
      this.resolveReady(session);
      return;
    }

    session.resetAttempted = true;
    logger.warn({ restaurantId: session.restaurantId }, 'WhatsApp session stuck while reconnecting. Resetting local auth and generating a fresh QR.');

    if (session.client) {
      try {
        await session.client.destroy();
      } catch (error) {
        logger.warn({ error, restaurantId: session.restaurantId }, 'WhatsApp client destroy failed during stuck session recovery');
      }
    }

    await this.cleanupStaleBrowsers(session.restaurantId);
    await this.resetAuthDirectory(session.restaurantId);
    session.client = undefined;
    session.initializing = false;
    session.status = {
      restaurantId: session.restaurantId,
      state: 'disconnected',
      lastError: 'Previous WhatsApp session was stale. Generating fresh QR.',
    };
    await this.persistStatus(session.status);
    await this.connectSession(session.restaurantId);
  }

  private async prepareAuthDirectory(restaurantId: string): Promise<void> {
    const authDir = path.resolve(process.cwd(), this.sessionPath, `session-restaurant-${restaurantId}`);
    const lockFiles = ['LOCK', 'lockfile', 'DevToolsActivePort'];

    try {
      if (!existsSync(authDir)) {
        return;
      }

      const defaultDir = path.join(authDir, 'Default');
      for (const fileName of lockFiles) {
        const filePath = path.join(authDir, fileName);
        if (existsSync(filePath)) {
          rmSync(filePath, { force: true });
        }
      }

      if (existsSync(defaultDir)) {
        for (const entry of readdirSync(defaultDir)) {
          if (
            entry === 'LOCK' ||
            entry.startsWith('Singleton') ||
            entry === 'DevToolsActivePort'
          ) {
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
      }
    } catch (error) {
      logger.warn({ error, restaurantId, authDir }, 'WhatsApp auth directory reset completed with warnings');
    }
  }
}
