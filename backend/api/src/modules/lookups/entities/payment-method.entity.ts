import { Entity, Index, OneToMany } from 'typeorm';
import { LookupEntity } from 'src/common/entities/lookup.entity';
import { PaymentMethodTranslation } from './payment-method-translation.entity';

/** Seeded: CASH, BANK_TRANSFER, INSTAPAY, WALLET, CHEQUE, CARD. */
@Entity('payment_methods')
@Index('uq_payment_methods_code', ['code'], { unique: true })
export class PaymentMethod extends LookupEntity {
  @OneToMany(() => PaymentMethodTranslation, (translation) => translation.paymentMethod, {
    cascade: ['insert', 'update'],
  })
  translations: PaymentMethodTranslation[];
}
