import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  NotificationEntityType,
  NotificationTemplateCode,
  PushSkipReason,
  PushStatus,
} from 'src/common/enums/notification.enum';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * One notification for one recipient (`18`).
 *
 * `title` and `body` are the **rendered** strings, not a template reference: a template that is
 * reworded next quarter must not silently rewrite what somebody was told last month, and a history
 * whose entries change meaning after the fact is worse than no history.
 *
 * The three `push_*` columns are the observable for the push leg. A notification whose push was
 * never attempted says so, and says why — the alternative is an in-app row that looks delivered
 * and a recipient who never heard anything.
 *
 * There is no soft delete: a notification is read or unread, and a user clearing his list is not
 * a business event anybody audits.
 */
@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt'])
@Index('idx_notifications_user_template', ['userId', 'templateCode', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'template_code', type: 'varchar', length: 40 })
  templateCode: NotificationTemplateCode;

  /** The locale the body was rendered in — the recipient's, never the actor's (`18`). */
  @Column({ type: 'varchar', length: 5 })
  locale: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 30, nullable: true })
  entityType: NotificationEntityType | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  /** `machinery://transfers/…` — what the Flutter app routes on (`18`, `20`). */
  @Column({ name: 'deep_link', type: 'text', nullable: true })
  deepLink: string | null;

  /** The placeholder values the body was rendered from, kept for the push data payload. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  data: Record<string, string>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'push_status', type: 'varchar', length: 20 })
  pushStatus: PushStatus;

  @Column({ name: 'push_skip_reason', type: 'varchar', length: 30, nullable: true })
  pushSkipReason: PushSkipReason | null;

  /** How many device tokens the message actually reached. Zero on every non-`SENT` status. */
  @Column({ name: 'push_delivered_count', type: 'int', default: 0 })
  pushDeliveredCount: number;

  @Column({ name: 'push_sent_at', type: 'timestamptz', nullable: true })
  pushSentAt: Date | null;

  /** When a quiet-hours deferral becomes sendable. Null unless `push_status` is `DEFERRED`. */
  @Column({ name: 'push_deferred_until', type: 'timestamptz', nullable: true })
  pushDeferredUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
