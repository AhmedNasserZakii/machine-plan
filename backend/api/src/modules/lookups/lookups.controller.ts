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
  CreateNameLookupDto,
  CreateViolationTypeDto,
  QueryLookupDto,
  UpdateNameLookupDto,
  UpdateViolationTypeDto,
} from './dto/lookup.dto';
import { LookupResponse, ViolationTypeResponse } from './dto/responses/lookup.response';
import { toLookupResponse, toViolationTypeResponse } from './mappers/lookup.mapper';
import { RawTranslationsGuard } from './raw-translations.guard';
import { DecommissionReasonsService } from './services/decommission-reasons.service';
import { MaintenanceLocationsService } from './services/maintenance-locations.service';
import { PaymentMethodsService } from './services/payment-methods.service';
import { ViolationTypesService } from './services/violation-types.service';

/**
 * The reference tables the app loads once and caches. Reads are open to any authenticated user
 * except payment methods, which the plan gates behind `finance.read`
 * (`15-feature-finance-transactions.md`). Writes always need `settings.manage`.
 */
@ApiTags('lookups')
@ApiBearerAuth('access-token')
@UseGuards(RawTranslationsGuard)
@Controller({ version: '1' })
export class LookupsController {
  constructor(
    private readonly paymentMethods: PaymentMethodsService,
    private readonly violationTypes: ViolationTypesService,
    private readonly maintenanceLocations: MaintenanceLocationsService,
    private readonly decommissionReasons: DecommissionReasonsService,
  ) {}

  @Get('payment-methods')
  @Permissions(Perm.FINANCE_READ)
  @ApiOperation({ summary: 'List payment methods' })
  @ApiResponse({ status: 200, type: [LookupResponse] })
  async listPaymentMethods(
    @ReqLocale() locale: Locale,
    @Query() query: QueryLookupDto,
  ): Promise<LookupResponse[]> {
    const rows = await this.paymentMethods.findAll(locale, query);
    return rows.map((row) => toLookupResponse(row, locale, query.rawTranslations));
  }

  @Post('payment-methods')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Add a payment method' })
  @ApiResponse({ status: 201, type: LookupResponse })
  async createPaymentMethod(
    @Body() dto: CreateNameLookupDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<LookupResponse> {
    return toLookupResponse(await this.paymentMethods.create(dto, actorId), locale);
  }

  @Patch('payment-methods/:id')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Rename or retire a payment method' })
  @ApiResponse({ status: 200, type: LookupResponse })
  async updatePaymentMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNameLookupDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<LookupResponse> {
    return toLookupResponse(await this.paymentMethods.update(id, dto, actorId), locale);
  }

  @Get('violation-types')
  @ApiOperation({ summary: 'List violation types with their default severity' })
  @ApiResponse({ status: 200, type: [ViolationTypeResponse] })
  async listViolationTypes(
    @ReqLocale() locale: Locale,
    @Query() query: QueryLookupDto,
  ): Promise<ViolationTypeResponse[]> {
    const rows = await this.violationTypes.findAll(locale, query);
    return rows.map((row) => toViolationTypeResponse(row, locale, query.rawTranslations));
  }

  @Post('violation-types')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Add a violation type' })
  @ApiResponse({ status: 201, type: ViolationTypeResponse })
  async createViolationType(
    @Body() dto: CreateViolationTypeDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationTypeResponse> {
    const created = await this.violationTypes.createViolationType(dto, actorId);
    return toViolationTypeResponse(created, locale);
  }

  @Patch('violation-types/:id')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update a violation type' })
  @ApiResponse({ status: 200, type: ViolationTypeResponse })
  async updateViolationType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViolationTypeDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<ViolationTypeResponse> {
    const updated = await this.violationTypes.updateViolationType(id, dto, actorId);
    return toViolationTypeResponse(updated, locale);
  }

  @Get('maintenance-locations')
  @ApiOperation({ summary: 'List maintenance locations' })
  @ApiResponse({ status: 200, type: [LookupResponse] })
  async listMaintenanceLocations(
    @ReqLocale() locale: Locale,
    @Query() query: QueryLookupDto,
  ): Promise<LookupResponse[]> {
    const rows = await this.maintenanceLocations.findAll(locale, query);
    return rows.map((row) => toLookupResponse(row, locale, query.rawTranslations));
  }

  @Post('maintenance-locations')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Add a maintenance location' })
  @ApiResponse({ status: 201, type: LookupResponse })
  async createMaintenanceLocation(
    @Body() dto: CreateNameLookupDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<LookupResponse> {
    return toLookupResponse(await this.maintenanceLocations.create(dto, actorId), locale);
  }

  @Get('decommission-reasons')
  @ApiOperation({ summary: 'List decommission reasons' })
  @ApiResponse({ status: 200, type: [LookupResponse] })
  async listDecommissionReasons(
    @ReqLocale() locale: Locale,
    @Query() query: QueryLookupDto,
  ): Promise<LookupResponse[]> {
    const rows = await this.decommissionReasons.findAll(locale, query);
    return rows.map((row) => toLookupResponse(row, locale, query.rawTranslations));
  }

  @Post('decommission-reasons')
  @Permissions(Perm.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Add a decommission reason' })
  @ApiResponse({ status: 201, type: LookupResponse })
  async createDecommissionReason(
    // Name only: `decommission_reason_translations` has no description column
    // (`02-database-localization-strategy.md`), so accepting one would discard it.
    @Body() dto: CreateNameLookupDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<LookupResponse> {
    return toLookupResponse(await this.decommissionReasons.create(dto, actorId), locale);
  }
}
