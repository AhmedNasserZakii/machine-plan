import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { MediaController } from './media.controller';
import { MediaOptimizeQueueService } from './media-optimize-queue.service';
import { MediaOptimizeService } from './media-optimize.service';
import { MediaService } from './media.service';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Media])],
  controllers: [MediaController],
  providers: [MediaService, StorageService, MediaOptimizeQueueService, MediaOptimizeService],
  exports: [MediaService, StorageService, MediaOptimizeQueueService],
})
export class MediaModule {}
