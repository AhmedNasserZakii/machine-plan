import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKeys, CacheService } from 'src/common/cache';
import { DEFAULT_LOCALE, Locale } from 'src/common/constants/locales';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import { NotificationChannel } from 'src/common/enums/operations.enum';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { templateDefinition } from '../notification-templates.catalogue';

/** A template resolved for one locale — everything the dispatcher needs to render a row. */
export interface ResolvedTemplate {
  code: NotificationTemplateCode;
  title: string;
  body: string;
  entityType: string | null;
  deepLinkTemplate: string | null;
  defaultChannels: NotificationChannel[];
  inAppLocked: boolean;
  ignoresQuietHours: boolean;
  isActive: boolean;
}

/** Templates change when somebody reseeds or retitles one, which is not an hourly event. */
const CACHE_TTL_SECONDS = 300;

/**
 * Reads the wording out of `notification_templates` for a given locale.
 *
 * The table is the source of truth so an operator can retitle an event without a release; the
 * code catalogue is the fallback for the window between a deploy that adds a template and the
 * seeder run that inserts it, which is otherwise a notification nobody receives.
 */
@Injectable()
export class NotificationTemplatesService {
  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templates: Repository<NotificationTemplate>,
    private readonly cache: CacheService,
  ) {}

  async resolve(code: NotificationTemplateCode, locale: Locale): Promise<ResolvedTemplate> {
    const byCode = await this.load(locale);

    return byCode[code] ?? this.fromCatalogue(code, locale);
  }

  /** Invalidates the per-locale cache. Called by the preferences admin path and the seeder. */
  async invalidate(): Promise<void> {
    await this.cache.del(
      CacheKeys.notificationTemplates(DEFAULT_LOCALE),
      CacheKeys.notificationTemplates('en'),
    );
  }

  private load(locale: Locale): Promise<Record<string, ResolvedTemplate>> {
    return this.cache.remember(
      CacheKeys.notificationTemplates(locale),
      CACHE_TTL_SECONDS,
      async () => {
        const rows = await this.templates.find({ relations: { translations: true } });
        const resolved: Record<string, ResolvedTemplate> = {};

        for (const row of rows) {
          const wording =
            row.translations.find((translation) => translation.locale === locale) ??
            row.translations.find((translation) => translation.locale === DEFAULT_LOCALE);

          if (!wording) continue;

          resolved[row.code] = {
            code: row.code,
            title: wording.title,
            body: wording.body,
            entityType: row.entityType,
            deepLinkTemplate: row.deepLinkTemplate,
            defaultChannels: row.defaultChannels,
            inAppLocked: row.inAppLocked,
            ignoresQuietHours: row.ignoresQuietHours,
            isActive: row.isActive,
          };
        }

        return resolved;
      },
    );
  }

  private fromCatalogue(code: NotificationTemplateCode, locale: Locale): ResolvedTemplate {
    const definition = templateDefinition(code);
    const wording = definition.translations[locale] ?? definition.translations[DEFAULT_LOCALE];

    return {
      code,
      title: wording.title,
      body: wording.body,
      entityType: definition.entityType,
      deepLinkTemplate: definition.deepLinkTemplate,
      defaultChannels: [...definition.defaultChannels],
      inAppLocked: definition.inAppLocked ?? false,
      ignoresQuietHours: definition.ignoresQuietHours ?? false,
      isActive: true,
    };
  }
}
