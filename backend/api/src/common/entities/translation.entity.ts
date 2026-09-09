import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Locale } from '../constants/locales';

/**
 * Base for every `*_translations` sibling table (see `02-database-localization-strategy.md`).
 * Translation rows have no soft delete — they cascade with their parent.
 */
export abstract class TranslationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 5 })
  locale: Locale;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** Translation carrying only a name. */
export abstract class NameTranslationEntity extends TranslationEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;
}

/** Translation carrying a name plus an optional description. */
export abstract class NameDescriptionTranslationEntity extends NameTranslationEntity {
  @Column({ type: 'text', nullable: true })
  description: string | null;
}
