import { readFileSync } from 'node:fs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { DeviceToken } from './entities/device-token.entity.js';

export interface PushMessage {
  title: string;
  body?: string | null;
  /** Read by the app to open the right screen; values are sent as strings */
  data?: Record<string, unknown>;
  /** Same tag replaces the previous push, e.g. one per conversation */
  tag?: string;
}

/** FCM tokens that will never work again */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Native push through Firebase Cloud Messaging.
 * Without FIREBASE_SERVICE_ACCOUNT_PATH it stays off and every send is a no-op.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private messaging: Messaging | null = null;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly devices: Repository<DeviceToken>,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const path = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!path) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set, push is off');
      return;
    }
    try {
      const app: App = initializeApp({
        credential: cert(JSON.parse(readFileSync(path, 'utf8'))),
      });
      this.messaging = getMessaging(app);
      this.logger.log('Firebase push is on');
    } catch (error) {
      this.logger.error(`Could not load Firebase credentials from ${path}`, error as Error);
    }
  }

  async register(userId: string, token: string, platform = 'android') {
    // A phone that changed hands moves to its new user
    await this.devices.upsert({ token, userId, platform }, ['token']);
  }

  async unregister(userId: string, token: string) {
    await this.devices.delete({ token, userId });
  }

  async send(userIds: string[], message: PushMessage): Promise<void> {
    if (!this.messaging || !userIds.length) return;
    const rows = await this.devices.find({
      where: { userId: In(userIds) },
      select: { token: true },
    });
    if (!rows.length) return;
    const tokens = rows.map((r) => r.token);

    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(message.data ?? {})) {
      if (value === undefined || value === null) continue;
      data[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    try {
      const result = await this.messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: message.title,
          ...(message.body && { body: message.body }),
        },
        data,
        android: {
          priority: 'high',
          // Must match the channel the app creates
          notification: { channelId: 'default', tag: message.tag },
        },
      });
      const dead = result.responses
        .map((r, i) => (!r.success && DEAD_TOKEN_CODES.has(r.error?.code ?? '') ? tokens[i] : null))
        .filter((t): t is string => !!t);
      if (dead.length) await this.devices.delete({ token: In(dead) });
    } catch (error) {
      this.logger.error('Push failed', error as Error);
    }
  }
}
