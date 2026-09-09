import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * The idempotency key of a scheduled notification (`18`, Scheduled jobs).
 *
 * Every sweep writes `{templateCode}:{entityId}:{bucket}` before it notifies, inside the same
 * transaction. A re-run, a second worker or a restart mid-sweep therefore collides on the primary
 * key and notifies nobody a second time — which matters because these jobs run hourly against
 * rows whose state has not changed.
 *
 * Kept in Postgres rather than in Redis: a dedupe key that evaporates when the cache restarts is
 * exactly the key you needed.
 */
@Entity('notification_dedupe')
@Index('idx_notification_dedupe_expires', ['expiresAt'])
export class NotificationDedupe {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  key: string;

  /** Matches the job's period, so the sweep may legitimately fire again next window. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
