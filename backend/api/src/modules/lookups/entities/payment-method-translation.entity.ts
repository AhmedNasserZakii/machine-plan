import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameTranslationEntity } from 'src/common/entities/translation.entity';
import { PaymentMethod } from './payment-method.entity';

@Entity('payment_method_translations')
@Unique('uq_payment_method_locale', ['paymentMethodId', 'locale'])
@Index('idx_pmt_locale', ['locale'])
export class PaymentMethodTranslation extends NameTranslationEntity {
  @Column({ name: 'payment_method_id', type: 'uuid' })
  paymentMethodId: string;

  @ManyToOne(() => PaymentMethod, (paymentMethod) => paymentMethod.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_method_id' })
  paymentMethod: PaymentMethod;
}
