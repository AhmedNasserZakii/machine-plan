import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MediaModule } from 'src/modules/media/media.module';
import { HealthController } from './health.controller';
import { StorageHealthIndicator } from './indicators/storage.health';
import { CacheHealthIndicator } from './indicators/cache.health';

@Module({
  // MediaModule exports StorageService, which the storage probe writes a canary through.
  imports: [TerminusModule, MediaModule],
  controllers: [HealthController],
  providers: [StorageHealthIndicator, CacheHealthIndicator],
})
export class HealthModule {}
