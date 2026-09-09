import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameDescriptionTranslationEntity } from 'src/common/entities/translation.entity';
import { ViolationType } from './violation-type.entity';

@Entity('violation_type_translations')
@Unique('uq_violation_type_locale', ['violationTypeId', 'locale'])
@Index('idx_vtt_locale', ['locale'])
export class ViolationTypeTranslation extends NameDescriptionTranslationEntity {
  @Column({ name: 'violation_type_id', type: 'uuid' })
  violationTypeId: string;

  @ManyToOne(() => ViolationType, (violationType) => violationType.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'violation_type_id' })
  violationType: ViolationType;
}
