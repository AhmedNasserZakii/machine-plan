import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

/**
 * One tunable number the Director may change without a deploy.
 *
 * Only *overrides* are stored: a key with no row reads the default from `settings.catalogue.ts`.
 * That is what keeps a new key working the moment it ships, with no seeding step and no window
 * where a threshold reads as zero because nobody has filled the table in yet.
 *
 * The value is text because the catalogue owns the type. A numeric column would have to be widened
 * the first time a boolean or a list of codes needs to live here.
 */
@Entity('settings')
export class Setting extends BaseEntity {
  @Column({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'text' })
  value: string;
}
