import { Column, Entity, Index, OneToMany } from 'typeorm';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { Severity } from 'src/common/enums/operations.enum';
import { ViolationTypeTranslation } from './violation-type-translation.entity';

/**
 * Seeded: BATTERY_MISMATCH, MISSING_CHARGER, MISSING_BOX, PHYSICAL_DAMAGE, LATE_RETURN,
 * MISSING_MACHINE, OTHER (`03-database-schema.md` §F).
 */
@Entity('violation_types')
@Index('uq_violation_types_code', ['code'], { unique: true })
export class ViolationType extends LookupEntity {
  /** Pre-fills the severity when a violation is auto-detected; the reviewer can still change it. */
  @Column({
    name: 'default_severity',
    type: 'varchar',
    length: 10,
    default: Severity.MEDIUM,
  })
  defaultSeverity: Severity;

  @OneToMany(() => ViolationTypeTranslation, (translation) => translation.violationType, {
    cascade: ['insert', 'update'],
  })
  translations: ViolationTypeTranslation[];
}
