import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Locale } from 'src/common/constants/locales';
import { CurrentUser, Permissions, ReqLocale } from 'src/common/decorators';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CreateFinanceCategoryDto,
  MoveFinanceCategoryDto,
  QueryFinanceCategoriesDto,
  QueryFinanceCategoryTreeDto,
  UpdateFinanceCategoryDto,
} from './dto/finance-category.dto';
import {
  FinanceCategoryBreadcrumbResponse,
  FinanceCategoryResponse,
} from './dto/responses/finance-category.response';
import {
  toBreadcrumbResponse,
  toFinanceCategoryResponse,
  toFinanceCategoryTreeResponse,
} from './mappers/finance-category.mapper';
import { FinanceCategoriesService } from './services/finance-categories.service';

/**
 * The category tree is company-wide reference data, so nothing here is branch-scoped: a branch
 * manager books against the same tree the Director reports on, or the roll-ups mean nothing.
 */
@ApiTags('finance')
@ApiBearerAuth('access-token')
@Controller({ path: 'finance/categories', version: '1' })
export class FinanceCategoriesController {
  constructor(private readonly categories: FinanceCategoriesService) {}

  @Get()
  @Permissions(Perm.FINANCE_READ)
  @ApiOperation({ summary: 'Categories as a flat list, with roll-ups intact' })
  @ApiResponse({ status: 200, type: [FinanceCategoryResponse] })
  async findAll(
    @Query() query: QueryFinanceCategoriesDto,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryResponse[]> {
    const nodes = await this.categories.findAll(query, locale);
    return nodes.map((node) => toFinanceCategoryResponse(node, locale));
  }

  /**
   * Declared before `:id` so the literal wins the route match, and returned whole in one call:
   * with dozens of categories that is far cheaper than lazy-loading each level (`14`).
   */
  @Get('tree')
  @Permissions(Perm.FINANCE_READ)
  @ApiOperation({ summary: 'The whole nested tree, already localized' })
  @ApiResponse({ status: 200, type: [FinanceCategoryResponse] })
  async tree(
    @Query() query: QueryFinanceCategoryTreeDto,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryResponse[]> {
    const nodes = await this.categories.tree(query, locale);
    return nodes.map((node) => toFinanceCategoryTreeResponse(node, locale));
  }

  @Get(':id')
  @Permissions(Perm.FINANCE_READ)
  @ApiOperation({ summary: 'One category' })
  @ApiResponse({ status: 200, type: FinanceCategoryResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryResponse> {
    return toFinanceCategoryResponse(await this.categories.findById(id, locale), locale);
  }

  @Get(':id/breadcrumb')
  @Permissions(Perm.FINANCE_READ)
  @ApiOperation({ summary: 'Root first, the category itself last' })
  @ApiResponse({ status: 200, type: [FinanceCategoryBreadcrumbResponse] })
  async breadcrumb(
    @Param('id', ParseUUIDPipe) id: string,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryBreadcrumbResponse[]> {
    const trail = await this.categories.breadcrumb(id, locale);
    return trail.map((category) => toBreadcrumbResponse(category, locale));
  }

  @Post()
  @Permissions(Perm.FINANCE_CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Add a category' })
  @ApiResponse({ status: 201, type: FinanceCategoryResponse })
  @ApiResponse({ status: 422, description: 'CATEGORY_KIND_MISMATCH' })
  async create(
    @Body() dto: CreateFinanceCategoryDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryResponse> {
    return toFinanceCategoryResponse(await this.categories.create(dto, actorId, locale), locale);
  }

  @Patch(':id')
  @Permissions(Perm.FINANCE_CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Rename, reorder or deactivate a category' })
  @ApiResponse({ status: 200, type: FinanceCategoryResponse })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceCategoryDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryResponse> {
    const updated = await this.categories.update(id, dto, actorId, locale);
    return toFinanceCategoryResponse(updated, locale);
  }

  @Patch(':id/move')
  @Permissions(Perm.FINANCE_CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Re-parent a category and its whole subtree' })
  @ApiResponse({ status: 200, type: FinanceCategoryResponse })
  @ApiResponse({ status: 422, description: 'CIRCULAR_CATEGORY_REFERENCE' })
  async move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveFinanceCategoryDto,
    @CurrentUser('id') actorId: string,
    @ReqLocale() locale: Locale,
  ): Promise<FinanceCategoryResponse> {
    return toFinanceCategoryResponse(await this.categories.move(id, dto, actorId, locale), locale);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permissions(Perm.FINANCE_CATEGORIES_MANAGE)
  @ApiOperation({ summary: 'Remove an unused category; deactivate one with history instead' })
  @ApiResponse({ status: 204, description: 'Removed' })
  @ApiResponse({ status: 403, description: 'SYSTEM_CATEGORY_PROTECTED' })
  @ApiResponse({ status: 409, description: 'CATEGORY_HAS_CHILDREN, CATEGORY_HAS_TRANSACTIONS' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    await this.categories.remove(id, actorId);
  }
}
