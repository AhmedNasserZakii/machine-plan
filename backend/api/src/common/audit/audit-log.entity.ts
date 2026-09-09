import { Column, Entity, PrimaryColumn } from 'typeorm';
import { AuditAction, AuditEntityType } from '../enums/audit.enum';

/**
 * One immutable row per audited event (`21`). Insert-only: the migration revokes `UPDATE` and
 * `DELETE` on this table from the application database role.
 *
 * The primary key is `(id, created_at)` rather than just `id` — Postgres requires every unique
 * index on a partitioned table, primary key included, to contain the partition column, and this
 * table is range-partitioned by `created_at` month. `id` alone is still effectively unique (it is
 * a UUID generated once per row), the composite key exists to satisfy Postgres rather than to
 * express a real second identity dimension.
 *
 * `userId` is nullable: an event with no authenticated principal — most importantly a failed
 * login attempt — must still be recorded (`2.1`, "safe handling for unauthenticated events").
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryColumn('uuid')
  id: string;

  @PrimaryColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 64 })
  action: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 40, nullable: true })
  entityType: AuditEntityType | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  // `object` rather than `Record<string, unknown>`: TypeORM's insert/update typings only line up
  // with a jsonb column for the broader type (see `StoredResponse` in the idempotency module for
  // the same workaround).
  @Column({ type: 'jsonb', nullable: true })
  before: object | null;

  @Column({ type: 'jsonb', nullable: true })
  after: object | null;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;
}
