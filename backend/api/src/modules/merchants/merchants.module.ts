import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceModule } from 'src/modules/finance/finance.module';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MediaModule } from 'src/modules/media/media.module';
import { MerchantSubscription } from './entities/merchant-subscription.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { SubscriptionsController } from './subscriptions.controller';

/**
 * `Machine` and `PaymentMethod` are registered as repositories rather than by importing their
 * modules: this one needs to count what a merchant holds and check a payment method exists, and
 * neither of those modules has any reason to know merchants exist.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Merchant, MerchantSubscription, Machine, PaymentMethod]),
    MediaModule,
    FinanceModule,
  ],
  controllers: [MerchantsController, SubscriptionsController],
  providers: [MerchantsService],
  exports: [MerchantsService, TypeOrmModule],
})
export class MerchantsModule {}
