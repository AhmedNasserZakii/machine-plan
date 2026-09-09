import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Machine } from 'src/modules/machines/entities/machine.entity';
import { MediaModule } from 'src/modules/media/media.module';
import { MerchantsModule } from 'src/modules/merchants/merchants.module';
import { Warehouse } from 'src/modules/organization/entities/warehouse.entity';
import { User } from 'src/modules/users/entities/user.entity';
import { ViolationsModule } from 'src/modules/violations/violations.module';
import { Transfer } from './entities/transfer.entity';
import { TransferItem } from './entities/transfer-item.entity';
import { TransferItemPhoto } from './entities/transfer-item-photo.entity';
import { TransferSignature } from './entities/transfer-signature.entity';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transfer,
      TransferItem,
      TransferItemPhoto,
      TransferSignature,
      Machine,
      Warehouse,
      User,
    ]),
    MediaModule,
    // Both flow one way: this module calls them, neither calls back. Merchants supply the
    // receiving side of a `REPRESENTATIVE_TO_MERCHANT`; violations run on the return legs.
    MerchantsModule,
    ViolationsModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
