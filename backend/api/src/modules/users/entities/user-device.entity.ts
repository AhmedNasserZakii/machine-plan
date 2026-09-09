import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from './user.entity';

export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
  WEB = 'WEB',
}

export const DEVICE_PLATFORMS = Object.values(DevicePlatform);

/**
 * A device belonging to a user. Two jobs:
 *   1. biometric confirmation — the server cannot verify a fingerprint, so a signature
 *      recorded as `BIOMETRIC` is only trusted from an **enrolled** device (`04`).
 *   2. push delivery — holds the FCM token (`18`).
 */
@Entity('user_devices')
@Unique('uq_user_device', ['userId', 'deviceId'])
@Index('idx_user_devices_user_id', ['userId'])
export class UserDevice extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Client-generated stable id, sent as the `X-Device-Id` header. */
  @Column({ name: 'device_id', type: 'varchar', length: 120 })
  deviceId: string;

  @Column({ name: 'device_model', type: 'varchar', length: 120, nullable: true })
  deviceModel: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  platform: DevicePlatform | null;

  @Column({ name: 'push_token', type: 'text', nullable: true })
  pushToken: string | null;

  @Column({ name: 'biometric_enrolled', type: 'boolean', default: false })
  biometricEnrolled: boolean;

  @Column({ name: 'biometric_enrolled_at', type: 'timestamptz', nullable: true })
  biometricEnrolledAt: Date | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
