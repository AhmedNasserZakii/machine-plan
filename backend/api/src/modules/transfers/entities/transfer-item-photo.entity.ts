import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Media } from 'src/modules/media/entities/media.entity';
import { TransferItem } from './transfer-item.entity';

/** Condition evidence. Capped at four per item in the service (`19`). */
@Entity('transfer_item_photos')
@Unique('uq_transfer_item_photo', ['transferItemId', 'mediaId'])
export class TransferItemPhoto extends BaseEntity {
  @Column({ name: 'transfer_item_id', type: 'uuid' })
  transferItemId: string;

  @Column({ name: 'media_id', type: 'uuid' })
  mediaId: string;

  @ManyToOne(() => TransferItem, (item) => item.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transfer_item_id' })
  transferItem: TransferItem;

  @ManyToOne(() => Media, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'media_id' })
  media: Media;
}
