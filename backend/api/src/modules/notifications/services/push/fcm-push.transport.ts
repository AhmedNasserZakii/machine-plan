import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';
import { NotificationsConfig } from 'src/config/notifications.config';
import { PushDeliveryResult, PushMessage, PushTransport } from './push.transport';

/** The FCM error codes that mean "this token will never work again" (`18`, delivery rule 4). */
const UNREGISTERED_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Firebase Cloud Messaging, for real, when a service account is configured — and visibly
 * unavailable when one is not.
 *
 * There is no fallback that pretends. A push nobody could have received is recorded on the
 * notification row as `SKIPPED / TRANSPORT_DISABLED`, because the alternative is a system that
 * reports deliveries it never made and an operator who finds out from the person who was never
 * told. The in-app row is written either way, so the notification itself is never lost.
 *
 * The SDK is imported lazily: it is a large dependency, and a deployment without FCM should not
 * pay to load it — nor should the test suite, which boots the application once per spec file.
 */
@Injectable()
export class FcmPushTransport implements PushTransport, OnModuleDestroy {
  private readonly logger = new Logger(FcmPushTransport.name);
  private readonly config: NotificationsConfig;
  private app: App | null = null;
  private messaging: Messaging | null = null;
  private initializing: Promise<Messaging | null> | null = null;

  constructor(config: ConfigService) {
    this.config = config.getOrThrow<NotificationsConfig>('notifications');

    if (this.config.fcmEnabled) {
      this.logger.log(`Push transport: FCM (project ${this.config.fcmProjectId})`);
    } else {
      this.logger.warn(
        `Push transport: disabled — ${this.unavailableReason ?? 'no credentials'}. ` +
          'In-app notifications are unaffected; every push will be recorded as skipped.',
      );
    }
  }

  get available(): boolean {
    return this.config.fcmEnabled;
  }

  get unavailableReason(): string | null {
    if (this.config.fcmEnabled) return null;

    const missing = [
      this.config.fcmProjectId ? null : 'FCM_PROJECT_ID',
      this.config.fcmClientEmail ? null : 'FCM_CLIENT_EMAIL',
      this.config.fcmPrivateKey ? null : 'FCM_PRIVATE_KEY',
    ].filter((name): name is string => name !== null);

    return `missing ${missing.join(', ')}`;
  }

  async send(message: PushMessage): Promise<PushDeliveryResult> {
    const empty: PushDeliveryResult = { delivered: 0, failed: 0, unregisteredTokens: [] };

    if (!this.available) {
      return { ...empty, transportError: this.unavailableReason ?? 'transport disabled' };
    }
    if (message.tokens.length === 0) return empty;

    const messaging = await this.resolveMessaging();
    if (!messaging) {
      return { ...empty, transportError: 'FCM initialisation failed' };
    }

    try {
      const response = await messaging.sendEachForMulticast({
        tokens: message.tokens,
        notification: { title: message.title, body: message.body },
        data: message.data,
        // Arabic titles are the norm here, so the payload is explicitly UTF-8 on both platforms
        // and the notification is tagged so a second push about the same entity replaces the
        // first in the tray rather than stacking.
        android: { priority: 'high', collapseKey: message.data.templateCode },
        apns: { headers: { 'apns-collapse-id': message.data.templateCode } },
      });

      const unregisteredTokens: string[] = [];

      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code ?? '';
        if (UNREGISTERED_CODES.has(code)) unregisteredTokens.push(message.tokens[index]);
      });

      return {
        delivered: response.successCount,
        failed: response.failureCount,
        unregisteredTokens,
      };
    } catch (error) {
      this.logger.warn({ err: error }, 'FCM send failed');
      return {
        ...empty,
        failed: message.tokens.length,
        transportError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.app) return;

    const { deleteApp } = await import('firebase-admin/app');
    await deleteApp(this.app).catch(() => undefined);
    this.app = null;
    this.messaging = null;
  }

  /** Initialised once and shared. The promise is memoised so concurrent sends do not race it. */
  private resolveMessaging(): Promise<Messaging | null> {
    if (this.messaging) return Promise.resolve(this.messaging);
    this.initializing ??= this.initialise();

    return this.initializing;
  }

  private async initialise(): Promise<Messaging | null> {
    try {
      const { cert, initializeApp } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');

      // Named so it cannot collide with an app another part of a host process registered.
      this.app = initializeApp(
        {
          credential: cert({
            projectId: this.config.fcmProjectId ?? undefined,
            clientEmail: this.config.fcmClientEmail ?? undefined,
            privateKey: this.config.fcmPrivateKey ?? undefined,
          }),
          projectId: this.config.fcmProjectId ?? undefined,
        },
        'machinery-notifications',
      );
      this.messaging = getMessaging(this.app);

      return this.messaging;
    } catch (error) {
      this.logger.error({ err: error }, 'Could not initialise the FCM transport');
      this.initializing = null;

      return null;
    }
  }
}
