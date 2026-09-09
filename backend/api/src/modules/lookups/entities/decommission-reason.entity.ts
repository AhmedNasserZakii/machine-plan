import { Entity, Index, OneToMany } from 'typeorm';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { DecommissionReasonTranslation } from './decommission-reason-translation.entity';

/** Seeded: BEYOND_REPAIR, NOT_COST_EFFECTIVE, OBSOLETE, LOST, STOLEN, OTHER. */
@Entity('decommission_reasons')
@Index('uq_decommission_reasons_code', ['code'], { unique: true })
export class DecommissionReason extends LookupEntity {
  @OneToMany(() => DecommissionReasonTranslation, (translation) => translation.decommissionReason, {
    cascade: ['insert', 'update'],
  })
  translations: DecommissionReasonTranslation[];
}
