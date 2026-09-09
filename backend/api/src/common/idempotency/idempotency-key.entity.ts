import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export const IdempotencyStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type IdempotencyStatusValue = (typeof IdempotencyStatus)[keyof typeof IdempotencyStatus];

/**
 * A recorded response: always the `{ success, data, meta? }` envelope, because the interceptor
 * that writes it runs outside the one that builds it.
 *
 * Typed as `object` rather than a keyed record because TypeORM treats a type with an index
 * signature as a nested entity to update field by field, which a stored JSON document is not.
 */
export type StoredResponse = object;

/**
 * One recorded attempt at a mutation, keyed by the `Idempotency-Key` the device generated
 * before it went offline (`20`, mechanism 2).
 *
 * The row is written **before** the handler runs, as `IN_PROGRESS`, so two requests carrying the
 * same key cannot both execute: the unique index decides which one proceeds. It flips to
 * `COMPLETED` with the response attached once the handler has produced one, and that stored
 * response is what every later replay of the same key receives.
 *
 * Not a `BaseEntity`: this is infrastructure rather than an operational record. It has no author,
 * is never soft-deleted, and is pruned by expiry instead.
 */
@Entity('idempotency_keys')
@Unique('uq_idempotency_user_key', ['userId', 'key'])
@Index('idx_idempotency_expires_at', ['expiresAt'])
export class IdempotencyKeyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  key: string;

  /**
   * Keys are scoped to the caller. Looking up by key alone would hand one user the stored
   * response of another the moment two devices picked the same value.
   */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** `POST /api/v1/transfers` — the route the key was first spent on. */
  @Column({ type: 'varchar', length: 200 })
  endpoint: string;

  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({ type: 'varchar', length: 20 })
  status: IdempotencyStatusValue;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  /** The full response envelope, replayed verbatim. Null while the first attempt is in flight. */
  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: StoredResponse | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
