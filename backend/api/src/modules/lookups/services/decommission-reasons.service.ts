import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DecommissionReason } from '../entities/decommission-reason.entity';
import { DecommissionReasonTranslation } from '../entities/decommission-reason-translation.entity';
import { LookupCrudService } from '../lookup-crud.service';

@Injectable()
export class DecommissionReasonsService extends LookupCrudService<
  DecommissionReasonTranslation,
  DecommissionReason
> {
  constructor(@InjectRepository(DecommissionReason) repository: Repository<DecommissionReason>) {
    super(repository, 'decommission_reason');
  }
}
