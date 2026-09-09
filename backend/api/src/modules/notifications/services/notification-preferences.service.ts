import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DEFAULT_LOCALE, isSupportedLocale, Locale } from 'src/common/constants/locales';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import { NotificationChannel } from 'src/common/enums/operations.enum';
import { User } from 'src/modules/users/entities/user.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import {
  NOTIFICATION_TEMPLATES,
  NotificationTemplateDefinition,
} from '../notification-templates.catalogue';
import { UpdateNotificationPreferencesDto } from '../dto/notification-preference.dto';
import { ResolvedTemplate } from './notification-templates.service';

export interface ChannelChoice {
  push: boolean;
  inApp: boolean;
}

export interface PreferenceEntry extends ChannelChoice {
  templateCode: NotificationTemplateCode;
  /** True when in-app cannot be switched off, so the client greys the toggle out. */
  inAppLocked: boolean;
}

export interface PreferencesView {
  locale: Locale;
  preferences: PreferenceEntry[];
}

/**
 * Per-user, per-template channel choices (`18`, Preferences).
 *
 * A user with no row for a template gets that template's defaults, so the absence of a row means
 * "subscribed" rather than "unknown" — a freshly created account hears about everything without
 * anybody writing eighteen rows for it.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async list(userId: string): Promise<PreferencesView> {
    const stored = await this.storedFor(userId);
    const user = await this.users.findOne({ where: { id: userId } });

    return {
      locale: isSupportedLocale(user?.preferredLocale) ? user.preferredLocale : DEFAULT_LOCALE,
      preferences: NOTIFICATION_TEMPLATES.filter(
        (template) => template.code !== NotificationTemplateCode.DIGEST,
      ).map((template) => ({
        templateCode: template.code,
        inAppLocked: template.inAppLocked ?? false,
        ...this.choiceFor(template, stored.get(template.code)),
      })),
    };
  }

  /**
   * A partial update: only the template codes named in the body are touched. The client screen
   * sends one toggle at a time on a slow connection, and replacing the whole set on each call
   * would let two in-flight requests undo each other.
   */
  async update(userId: string, dto: UpdateNotificationPreferencesDto): Promise<PreferencesView> {
    await this.dataSource.transaction(async (manager) => {
      if (dto.locale) {
        await manager.getRepository(User).update(userId, { preferredLocale: dto.locale });
      }

      for (const entry of dto.preferences ?? []) {
        const repository = manager.getRepository(NotificationPreference);
        const existing = await repository.findOne({
          where: { userId, templateCode: entry.templateCode },
        });

        if (existing) {
          await repository.update(existing.id, {
            ...(entry.push !== undefined ? { push: entry.push } : {}),
            ...(entry.inApp !== undefined ? { inApp: entry.inApp } : {}),
            updatedBy: userId,
          });
          continue;
        }

        const defaults = this.choiceFor(
          NOTIFICATION_TEMPLATES.find((template) => template.code === entry.templateCode),
          undefined,
        );

        await repository.save(
          repository.create({
            userId,
            templateCode: entry.templateCode,
            push: entry.push ?? defaults.push,
            inApp: entry.inApp ?? defaults.inApp,
            createdBy: userId,
          }),
        );
      }
    });

    return this.list(userId);
  }

  /**
   * The channels a notification may actually use for this recipient.
   *
   * In-app is forced on for the locked templates: a representative who muted `TRANSFER_PENDING`
   * would never learn a delivery is waiting for his signature, and the machines would sit in
   * transit until somebody phoned him.
   */
  async resolve(
    userIds: readonly string[],
    template: ResolvedTemplate,
  ): Promise<Map<string, ChannelChoice>> {
    const unique = [...new Set(userIds)];
    const resolved = new Map<string, ChannelChoice>();
    if (unique.length === 0) return resolved;

    const stored = await this.preferences.find({
      where: { userId: In(unique), templateCode: template.code },
    });
    const byUser = new Map(stored.map((row) => [row.userId, row]));

    for (const userId of unique) {
      const row = byUser.get(userId);
      const defaults = {
        push: template.defaultChannels.includes(NotificationChannel.PUSH),
        inApp: template.defaultChannels.includes(NotificationChannel.IN_APP),
      };

      resolved.set(userId, {
        push: row ? row.push : defaults.push,
        inApp: template.inAppLocked ? true : row ? row.inApp : defaults.inApp,
      });
    }

    return resolved;
  }

  private async storedFor(userId: string): Promise<Map<string, NotificationPreference>> {
    const rows = await this.preferences.find({ where: { userId } });

    return new Map(rows.map((row) => [row.templateCode, row]));
  }

  private choiceFor(
    template: NotificationTemplateDefinition | undefined,
    stored: NotificationPreference | undefined,
  ): ChannelChoice {
    const defaults = {
      push: template?.defaultChannels.includes(NotificationChannel.PUSH) ?? true,
      inApp: template?.defaultChannels.includes(NotificationChannel.IN_APP) ?? true,
    };

    return {
      push: stored ? stored.push : defaults.push,
      inApp: template?.inAppLocked ? true : stored ? stored.inApp : defaults.inApp,
    };
  }
}
