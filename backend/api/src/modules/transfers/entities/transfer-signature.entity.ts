import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ImmutableEntity } from 'src/common/entities/base.entity';
import { SignatureMethod, SignaturePartyRole } from 'src/common/enums/transfer.enum';
import { Media } from 'src/modules/media/entities/media.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { Transfer } from './transfer.entity';

/**
 * The evidence that someone accepted custody. Insert-only: a signature that can be edited after
 * the fact proves nothing, which is why this extends `ImmutableEntity` and the migration revokes
 * UPDATE and DELETE on the table.
 *
 * `payloadHash` is a SHA-256 of the exact item list as it stood when the pen came off the screen.
 * If the contents change afterwards, the hash no longer matches and the signature is visibly
 * against a different document.
 */
@Entity('transfer_signatures')
@Index('idx_transfer_signatures_transfer', ['transferId'])
export class TransferSignature extends ImmutableEntity {
  @Column({ name: 'transfer_id', type: 'uuid' })
  transferId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'party_role', type: 'varchar', length: 20 })
  partyRole: SignaturePartyRole;

  @Column({ type: 'varchar', length: 20 })
  method: SignatureMethod;

  /** The drawn image. Null when the device verified a fingerprint or face instead. */
  @Column({ name: 'signature_media_id', type: 'uuid', nullable: true })
  signatureMediaId: string | null;

  @Column({ name: 'biometric_verified_at', type: 'timestamptz', nullable: true })
  biometricVerifiedAt: Date | null;

  @Column({ name: 'device_id', type: 'varchar', length: 120, nullable: true })
  deviceId: string | null;

  @Column({ name: 'device_model', type: 'varchar', length: 120, nullable: true })
  deviceModel: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz' })
  signedAt: Date;

  @Column({ name: 'payload_hash', type: 'varchar', length: 128 })
  payloadHash: string;

  @ManyToOne(() => Transfer, (transfer) => transfer.signatures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_id' })
  transfer: Transfer;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @ManyToOne(() => Media, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'signature_media_id' })
  signatureMedia?: Media | null;
}
