import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { CurrentUser, Permissions, ReqLocale } from 'src/common/decorators';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CreateMachineModelDto,
  CreateMachineTypeDto,
  QueryLookupDto,
  QueryMachineModelsDto,
  UpdateMachineModelDto,
  UpdateMachineTypeDto,
} from './dto/lookup.dto';
import { MachineModelResponse, MachineTypeResponse } from './dto/responses/lookup.response';
import { toMachineModelResponse, toMachineTypeResponse } from './mappers/lookup.mapper';
import { RawTranslationsGuard } from './raw-translations.guard';
import { MachineModelsService } from './services/machine-models.service';
import { MachineTypesService } from './services/machine-types.service';

/**
 * Machine types and the models beneath them. Reads are open to any authenticated user because
 * every machine form needs them; writes need `settings.manage` (`07-feature-machines-batteries.md`).
 */
@ApiTags('machine-catalogue')
@ApiBearerAuth('access-token')
@UseGuards(RawTranslationsGuard)
@Controller({ version: '1' })
export class MachineCatalogueController {
  constructor(
    private readonly machineTypes: MachineTypesService,
    private readonly machineModels: MachineModelsService,
  ) {}

  @Get('machine-types')
  @ApiOperation({ summary: 'List machine types, names resolved for the request locale' })
  @ApiResponse({ status: 200, type: [MachineTypeResponse] })
  async listTypes(
    @ReqLocale() locale: Locale,
    @Query() query: QueryLookupDto,
  ): Promise<MachineTypeResponse[]> {
    const types = await this.machineTypes.findAll(locale, query);
    return types.map((type) => toMachineTypeResponse(type, locale, query.rawTranslations));
  }

  @Post('machine-types')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Add a machine type' })
  @ApiResponse({ status: 201, type: MachineTypeResponse })
  @ApiResponse({ status: 409, description: 'CODE_EXISTS' })
  async createType(
    @Body() dto: CreateMachineTypeDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<MachineTypeResponse> {
    const created = await this.machineTypes.createMachineType(dto, actorId);
    return toMachineTypeResponse(created, locale);
  }

  @Patch('machine-types/:id')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Rename, retire, or change the SIM requirement of a machine type' })
  @ApiResponse({ status: 200, type: MachineTypeResponse })
  async updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMachineTypeDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<MachineTypeResponse> {
    const updated = await this.machineTypes.updateMachineType(id, dto, actorId);
    return toMachineTypeResponse(updated, locale);
  }

  @Get('machine-models')
  @ApiOperation({ summary: 'List machine models, optionally filtered to one type' })
  @ApiResponse({ status: 200, type: [MachineModelResponse] })
  async listModels(
    @ReqLocale() locale: Locale,
    @Query() query: QueryMachineModelsDto,
  ): Promise<MachineModelResponse[]> {
    const models = await this.machineModels.findAllByType(locale, query.machineTypeId, query);
    return models.map((model) => toMachineModelResponse(model, locale, query.rawTranslations));
  }

  @Post('machine-models')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Add a machine model under a type' })
  @ApiResponse({ status: 201, type: MachineModelResponse })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED — unknown machineTypeId' })
  async createModel(
    @Body() dto: CreateMachineModelDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<MachineModelResponse> {
    const created = await this.machineModels.createMachineModel(dto, actorId);
    return toMachineModelResponse(await this.machineModels.findById(created.id, locale), locale);
  }

  @Patch('machine-models/:id')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update a machine model' })
  @ApiResponse({ status: 200, type: MachineModelResponse })
  async updateModel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMachineModelDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<MachineModelResponse> {
    await this.machineModels.updateMachineModel(id, dto, actorId);
    return toMachineModelResponse(await this.machineModels.findById(id, locale), locale);
  }
}
