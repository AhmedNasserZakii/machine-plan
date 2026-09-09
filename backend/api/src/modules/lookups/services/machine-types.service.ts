import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMachineTypeDto, UpdateMachineTypeDto } from '../dto/lookup.dto';
import { MachineType } from '../entities/machine-type.entity';
import { MachineTypeTranslation } from '../entities/machine-type-translation.entity';
import { LookupCrudService } from '../lookup-crud.service';

@Injectable()
export class MachineTypesService extends LookupCrudService<MachineTypeTranslation, MachineType> {
  constructor(@InjectRepository(MachineType) repository: Repository<MachineType>) {
    super(repository, 'machine_type');
  }

  createMachineType(dto: CreateMachineTypeDto, actorId: string): Promise<MachineType> {
    const { requiresSim, ...base } = dto;
    return this.create(base, actorId, requiresSim === undefined ? {} : { requiresSim });
  }

  updateMachineType(id: string, dto: UpdateMachineTypeDto, actorId: string): Promise<MachineType> {
    const { requiresSim, ...base } = dto;
    return this.update(id, base, actorId, requiresSim === undefined ? {} : { requiresSim });
  }
}
