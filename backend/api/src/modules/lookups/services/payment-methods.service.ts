import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentMethodTranslation } from '../entities/payment-method-translation.entity';
import { LookupCrudService } from '../lookup-crud.service';

@Injectable()
export class PaymentMethodsService extends LookupCrudService<
  PaymentMethodTranslation,
  PaymentMethod
> {
  constructor(@InjectRepository(PaymentMethod) repository: Repository<PaymentMethod>) {
    super(repository, 'payment_method');
  }
}
