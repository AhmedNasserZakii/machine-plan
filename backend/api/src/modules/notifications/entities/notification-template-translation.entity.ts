import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { TranslationEntity } from 'src/common/entities/translation.entity';
import { NotificationTemplate } from './notification-template.entity';

/** The `ar` / `en` wording of one template. `body` carries `{placeholder}` tokens (`18`). */
@Entity('notification_template_translations')
@Unique('uq_notification_template_locale', ['notificationTemplateId', 'locale'])
@Index('idx_ntt_locale', ['locale'])
export class NotificationTemplateTranslation extends TranslationEntity {
  @Column({ name: 'notification_template_id', type: 'uuid' })
  notificationTemplateId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @ManyToOne(() => NotificationTemplate, (template) => template.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_template_id' })
  template: NotificationTemplate;
}
