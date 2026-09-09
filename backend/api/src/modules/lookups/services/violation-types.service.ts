import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateViolationTypeDto, UpdateViolationTypeDto } from '../dto/lookup.dto';
import { ViolationType } from '../entities/violation-type.entity';
import { ViolationTypeTranslation } from '../entities/violation-type-translation.entity';
import { LookupCrudService } from '../lookup-crud.service';

@Injectable()
export class ViolationTypesService extends LookupCrudService<
  ViolationTypeTranslation,
  ViolationType
> {
  constructor(@InjectRepository(ViolationType) repository: Repository<ViolationType>) {
    super(repository, 'violation_type');
  }

  createViolationType(dto: CreateViolationTypeDto, actorId: string): Promise<ViolationType> {
    const { defaultSeverity, ...base } = dto;
    return this.create(base, actorId, defaultSeverity ? { defaultSeverity } : {});
  }

  updateViolationType(
    id: string,
    dto: UpdateViolationTypeDto,
    actorId: string,
  ): Promise<ViolationType> {
    const { defaultSeverity, ...base } = dto;
    return this.update(id, base, actorId, defaultSeverity ? { defaultSeverity } : {});
  }
}
