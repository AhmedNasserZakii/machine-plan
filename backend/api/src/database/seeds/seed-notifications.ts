import { DataSource } from 'typeorm';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';
import { NotificationTemplate } from 'src/modules/notifications/entities/notification-template.entity';
import { NotificationTemplateTranslation } from 'src/modules/notifications/entities/notification-template-translation.entity';
import { NOTIFICATION_TEMPLATES } from 'src/modules/notifications/notification-templates.catalogue';
import { SeedLogger } from './seed-logger';

/**
 * Seeds the notification templates and both locales of their wording (`18`, `02`).
 *
 * Idempotent by `code`, and narrow on purpose: an existing row keeps `is_active` and its channel
 * list, because those are the two things an operator turns off deliberately and a redeploy that
 * switched a muted event back on would be indistinguishable from a bug. Only the wording, the
 * deep link and the two structural flags the trigger sites depend on are refreshed.
 */
export async function seedNotifications(dataSource: DataSource, log: SeedLogger): Promise<void> {
  const templates = dataSource.getRepository(NotificationTemplate);
  const translations = dataSource.getRepository(NotificationTemplateTranslation);

  let created = 0;
  let updated = 0;

  for (const definition of NOTIFICATION_TEMPLATES) {
    const existing = await templates.findOne({ where: { code: definition.code } });
    const shape = {
      entityType: definition.entityType,
      inAppLocked: definition.inAppLocked ?? false,
      ignoresQuietHours: definition.ignoresQuietHours ?? false,
      deepLinkTemplate: definition.deepLinkTemplate,
    };

    let id: string;

    if (existing) {
      await templates.update(existing.id, shape);
      id = existing.id;
      updated += 1;
    } else {
      const saved = await templates.save(
        templates.create({
          code: definition.code,
          defaultChannels: [...definition.defaultChannels],
          isActive: true,
          ...shape,
        }),
      );
      id = saved.id;
      created += 1;
    }

    for (const locale of SUPPORTED_LOCALES) {
      const wording = definition.translations[locale];
      const present = await translations.findOne({
        where: { notificationTemplateId: id, locale },
      });

      if (present) await translations.update(present.id, wording);
      else
        await translations.save(
          translations.create({ notificationTemplateId: id, locale, ...wording }),
        );
    }
  }

  log.step(`notification templates: ${created} created, ${updated} updated`);
}
