import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import {
  NotificationEntityType,
  NotificationTemplateCode,
} from 'src/common/enums/notification.enum';
import { NotificationChannel } from 'src/common/enums/operations.enum';
import { NotificationTemplateTranslation } from './notification-template-translation.entity';

/**
 * The wording of one event, per locale (`18`, and the localized-entity list in `02`).
 *
 * `default_channels` is what a user with no preference row gets. `in_app_locked` marks the
 * templates in-app delivery cannot be switched off for — `TRANSFER_PENDING` is operationally
 * critical, and a representative who muted it would simply never learn a delivery is waiting for
 * his signature.
 */
@Entity('notification_templates')
@Index('uq_notification_templates_code', ['code'], { unique: true })
export class NotificationTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 40 })
  code: NotificationTemplateCode;

  @Column({ name: 'entity_type', type: 'varchar', length: 30, nullable: true })
  entityType: NotificationEntityType | null;

  @Column({ name: 'default_channels', type: 'text', array: true })
  defaultChannels: NotificationChannel[];

  @Column({ name: 'in_app_locked', type: 'boolean', default: false })
  inAppLocked: boolean;

  /** `18`, delivery rule 2: these two are urgent enough to wake somebody up. */
  @Column({ name: 'ignores_quiet_hours', type: 'boolean', default: false })
  ignoresQuietHours: boolean;

  /** `machinery://transfers/{entityId}` — `{entityId}` is the only token substituted. */
  @Column({ name: 'deep_link_template', type: 'text', nullable: true })
  deepLinkTemplate: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => NotificationTemplateTranslation, (translation) => translation.template, {
    cascade: ['insert', 'update'],
  })
  translations: NotificationTemplateTranslation[];
}
