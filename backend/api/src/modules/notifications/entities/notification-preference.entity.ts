import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { NotificationTemplateCode } from 'src/common/enums/notification.enum';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * One user's opt-out for one template code (`18`, Preferences).
 *
 * A small table rather than a JSONB column on `users`: the sweeps read "who still wants
 * `SUBSCRIPTION_OVERDUE`" as a join, and doing that against a JSON document would mean loading
 * every account to filter it in memory.
 *
 * Rows are created on demand, so absence means "the template's defaults apply" — a fresh account
 * is subscribed to everything without anybody having to write eighteen rows for it.
 */
@Entity('notification_preferences')
@Unique('uq_notification_preference', ['userId', 'templateCode'])
@Index('idx_notification_preferences_user', ['userId'])
export class NotificationPreference extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'template_code', type: 'varchar', length: 40 })
  templateCode: NotificationTemplateCode;

  @Column({ type: 'boolean', default: true })
  push: boolean;

  /** Ignored for templates the catalogue marks `in_app_locked`. */
  @Column({ name: 'in_app', type: 'boolean', default: true })
  inApp: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
