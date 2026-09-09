import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * Rotating refresh tokens. Only the SHA-256 digest is stored, so a database leak does not
 * hand over live sessions.
 *
 * `replaced_by_id` chains rotations together: re-using an already-rotated token means the
 * token was stolen, so the whole device chain is revoked (`04-auth-and-permissions.md`).
 */
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Index('idx_refresh_tokens_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index('uq_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ name: 'device_id', type: 'varchar', length: 120, nullable: true })
  deviceId: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 40, nullable: true })
  revokedReason: string | null;

  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true })
  replacedById: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}

export const RevokeReason = {
  LOGOUT: 'LOGOUT',
  ROTATED: 'ROTATED',
  REUSE_DETECTED: 'REUSE_DETECTED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  ADMIN_RESET: 'ADMIN_RESET',
} as const;
