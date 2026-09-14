import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ErrorCode } from 'src/common/constants/error-codes';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AppException } from 'src/common/errors';
import { joinTranslation } from 'src/common/utils';
import {
  CreateMachineModelDto,
  QueryMachineModelsDto,
  UpdateMachineModelDto,
} from '../dto/lookup.dto';
import { MachineModel } from '../entities/machine-model.entity';
import { MachineModelTranslation } from '../entities/machine-model-translation.entity';
import { MachineType } from '../entities/machine-type.entity';
import { LookupCrudService } from '../lookup-crud.service';

@Injectable()
export class MachineModelsService extends LookupCrudService<MachineModelTranslation, MachineModel> {
  constructor(
    @InjectRepository(MachineModel) repository: Repository<MachineModel>,
    @InjectRepository(MachineType) private readonly machineTypes: Repository<MachineType>,
  ) {
    super(repository, 'machine_model');
  }

  /** Models are usually listed for one type at a time, to populate a dependent dropdown. */
  async findAllByType(
    locale: Locale,
    query: QueryMachineModelsDto,
  ): Promise<PaginatedResult<MachineModel>> {
    const qb = this.listQuery(locale, query);

    if (query.machineTypeId) {
      qb.andWhere(`${this.alias}.machine_type_id = :machineTypeId`, {
        machineTypeId: query.machineTypeId,
      });
    }

    const [rows, total] = await qb.skip(query.skip).take(query.take).getManyAndCount();
    return new PaginatedResult(rows, total, query.page, query.limit);
  }

  async createMachineModel(dto: CreateMachineModelDto, actorId: string): Promise<MachineModel> {
    const { machineTypeId, manufacturer, ...base } = dto;
    await this.assertMachineTypeExists(machineTypeId);

    return this.create(base, actorId, { machineTypeId, manufacturer: manufacturer ?? null });
  }

  async updateMachineModel(
    id: string,
    dto: UpdateMachineModelDto,
    actorId: string,
  ): Promise<MachineModel> {
    const { machineTypeId, manufacturer, ...base } = dto;

    if (machineTypeId) await this.assertMachineTypeExists(machineTypeId);

    return this.update(id, base, actorId, {
      ...(machineTypeId ? { machineTypeId } : {}),
      ...(manufacturer !== undefined ? { manufacturer } : {}),
    });
  }

  /** A model is meaningless without its type, so every read resolves the type name too. */
  protected override applyRelations(qb: SelectQueryBuilder<MachineModel>, locale: Locale): void {
    qb.leftJoinAndSelect(`${this.alias}.machineType`, 'machine_type');
    joinTranslation(qb, 'machine_type', 'translations', locale);
  }

  private async assertMachineTypeExists(machineTypeId: string): Promise<void> {
    const exists = await this.machineTypes.exists({ where: { id: machineTypeId } });
    if (!exists) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [
          { field: 'machineTypeId', value: machineTypeId, constraint: 'unknown machine type' },
        ],
      });
    }
  }
}
