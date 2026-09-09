import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameDescriptionTranslationEntity } from 'src/common/entities/translation.entity';
import { FinanceCategory } from './finance-category.entity';

@Entity('finance_category_translations')
@Unique('uq_finance_category_locale', ['financeCategoryId', 'locale'])
@Index('idx_fct_locale', ['locale'])
export class FinanceCategoryTranslation extends NameDescriptionTranslationEntity {
  @Column({ name: 'finance_category_id', type: 'uuid' })
  financeCategoryId: string;

  @ManyToOne(() => FinanceCategory, (category) => category.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'finance_category_id' })
  category: FinanceCategory;
}
