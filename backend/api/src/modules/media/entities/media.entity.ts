import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { MediaPurpose } from 'src/common/enums/operations.enum';
import { User } from 'src/modules/users/entities/user.entity';

/**
 * One stored object. Rows are created *before* the bytes exist — the client asks for a presigned
 * URL, uploads straight to storage, then confirms — so an unconfirmed row is normal for a few
 * seconds and abandoned for good after a failed upload. Only confirmed media may be attached to
 * anything, which is what keeps a signature from pointing at an empty key.
 */
@Entity('media')
@Index('idx_media_purpose_confirmed', ['purpose', 'isConfirmed'])
@Index('idx_media_uploaded_by', ['uploadedByUserId'])
export class Media extends BaseEntity {
  @Column({ name: 'storage_key', type: 'text', unique: true })
  storageKey: string;

  @Column({ type: 'varchar', length: 30 })
  purpose: MediaPurpose;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  /** Declared at presign, overwritten with the real object size at confirm. */
  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: string;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  /** Client-computed SHA-256 of the bytes, verified at confirm when storage reports one. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum: string | null;

  @Column({ name: 'is_confirmed', type: 'boolean', default: false })
  isConfirmed: boolean;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  /** The 320px WebP variant's storage key. Null until `MediaOptimizeService` has run. */
  @Column({ name: 'thumbnail_key', type: 'text', nullable: true })
  thumbnailKey: string | null;

  /** True once the worker has re-encoded this object to WebP and built its thumbnail. Never set
   * for `SIGNATURE` media — those are preserved byte-for-byte as evidence (`19`). */
  @Column({ name: 'is_optimized', type: 'boolean', default: false })
  isOptimized: boolean;

  @Column({ name: 'optimized_at', type: 'timestamptz', nullable: true })
  optimizedAt: Date | null;

  @Column({ name: 'uploaded_by_user_id', type: 'uuid' })
  uploadedByUserId: string;

  /**
   * Generated on the device when the photo is captured, long before there is a connection to
   * upload it over. Offline operations reference their evidence by this id (`20`).
   */
  @Column({ name: 'client_uuid', type: 'uuid', nullable: true, unique: true })
  clientUuid: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy?: User;
}
