import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { NameTranslationEntity } from 'src/common/entities/translation.entity';
import { MaintenanceLocation } from './maintenance-location.entity';

@Entity('maintenance_location_translations')
@Unique('uq_maintenance_location_locale', ['maintenanceLocationId', 'locale'])
@Index('idx_mlt_locale', ['locale'])
export class MaintenanceLocationTranslation extends NameTranslationEntity {
  @Column({ name: 'maintenance_location_id', type: 'uuid' })
  maintenanceLocationId: string;

  @ManyToOne(() => MaintenanceLocation, (location) => location.translations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'maintenance_location_id' })
  maintenanceLocation: MaintenanceLocation;
}
