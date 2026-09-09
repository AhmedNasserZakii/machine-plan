import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameTranslationEntity } from 'src/common/entities/translation.entity';
import { DecommissionReason } from './decommission-reason.entity';

@Entity('decommission_reason_translations')
@Unique('uq_decommission_reason_locale', ['decommissionReasonId', 'locale'])
@Index('idx_drt_locale', ['locale'])
export class DecommissionReasonTranslation extends NameTranslationEntity {
  @Column({ name: 'decommission_reason_id', type: 'uuid' })
  decommissionReasonId: string;

  @ManyToOne(() => DecommissionReason, (reason) => reason.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'decommission_reason_id' })
  decommissionReason: DecommissionReason;
}
