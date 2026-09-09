import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceModule } from 'src/modules/finance/finance.module';
import { PaymentMethod } from 'src/modules/lookups/entities/payment-method.entity';
import { ViolationType } from 'src/modules/lookups/entities/violation-type.entity';
import { TransferItem } from 'src/modules/transfers/entities/transfer-item.entity';
import { Violation } from './entities/violation.entity';
import { UserViolationsController, ViolationsController } from './violations.controller';
import { ViolationsService } from './violations.service';

/**
 * Registers `TransferItem` as a repository rather than importing `TransfersModule`, and the
 * dependency runs the other way: `TransfersModule` imports this one so a confirming return leg can
 * call the detector. Importing back would close the cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Violation, ViolationType, TransferItem, PaymentMethod]),
    FinanceModule,
  ],
  controllers: [ViolationsController, UserViolationsController],
  providers: [ViolationsService],
  exports: [ViolationsService],
})
export class ViolationsModule {}
