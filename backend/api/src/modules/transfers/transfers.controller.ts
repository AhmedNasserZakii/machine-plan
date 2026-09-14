import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  BranchScoped,
  CurrentUser,
  Idempotent,
  Permissions,
  ReqLocale,
  Scope,
} from 'src/common/decorators';
import { Locale } from 'src/common/constants/locales';
import { PaginatedResult } from 'src/common/dto/paginated-result';
import { AuthUser, BranchScope, RequestContext } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  CancelTransferDto,
  ConfirmTransferDto,
  CreateTransferDto,
  QueryTransfersDto,
  RejectTransferDto,
  TransferRecipientsQueryDto,
} from './dto/transfer.dto';
import {
  CreatableTransferTypeResponse,
  TransferListItemResponse,
  TransferRecipientResponse,
  TransferResponse,
  TransferSignatureMediaResponse,
  TransferValidationResponse,
} from './dto/responses/transfer.response';
import { toTransferListItemResponse, toTransferResponse } from './mappers/transfer.mapper';
import { TransferActor, TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth('access-token')
@Controller({ path: 'transfers', version: '1' })
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @Permissions(Perm.TRANSFERS_READ)
  @BranchScoped(Perm.TRANSFERS_READ_ALL)
  @ApiOperation({
    summary: 'List transfers; branch-scoped unless the caller has transfers.read.all',
  })
  @ApiResponse({ status: 200, type: [TransferListItemResponse] })
  async findAll(
    @Query() query: QueryTransfersDto,
    @Scope() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedResult<TransferListItemResponse>> {
    const page = await this.transfers.findAll(query, scope, user);
    return page.map(toTransferListItemResponse);
  }

  /** Declared before `:id` so the literal path is not parsed as a uuid. */
  @Get('pending/incoming')
  @Permissions(Perm.TRANSFERS_READ)
  @ApiOperation({ summary: 'My inbox: transfers waiting for my signature' })
  @ApiResponse({ status: 200, type: [TransferListItemResponse] })
  async incoming(
    @Query() query: QueryTransfersDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedResult<TransferListItemResponse>> {
    const page = await this.transfers.incoming(user, query);
    return page.map(toTransferListItemResponse);
  }

  @Get('pending/outgoing')
  @Permissions(Perm.TRANSFERS_READ)
  @ApiOperation({ summary: 'What I have sent that nobody has signed for yet' })
  @ApiResponse({ status: 200, type: [TransferListItemResponse] })
  async outgoing(
    @Query() query: QueryTransfersDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedResult<TransferListItemResponse>> {
    const page = await this.transfers.outgoing(user, query);
    return page.map(toTransferListItemResponse);
  }

  @Get('creatable-types')
  @Permissions(Perm.TRANSFERS_CREATE)
  @ApiOperation({
    summary: 'Which hand-offs this caller may start',
    description:
      'The rules map lives on the server. A director and a supervisor both hold transfers.create ' +
      'but may start different types, so the client asks rather than keeping its own copy. ' +
      'Fixed catalogue bounded by code. Not paginated.',
  })
  @ApiResponse({ status: 200, type: [CreatableTransferTypeResponse] })
  creatableTypes(@CurrentUser() user: AuthUser): CreatableTransferTypeResponse[] {
    return this.transfers.creatableTypes(user);
  }

  @Get('recipients')
  @Permissions(Perm.TRANSFERS_CREATE)
  @BranchScoped(Perm.MERCHANTS_READ_ALL)
  @ApiOperation({
    summary: 'Who this caller may hand a given transfer type to',
    description:
      'Gated on transfers.create rather than users.read: a supervisor picking a representative ' +
      'must not need the ability to read the user directory. Merchants come back scoped the way ' +
      'the merchant list is. Returns [] for types whose receiver is not an account — the factory, ' +
      'a service centre, the scrapyard.',
  })
  @ApiResponse({ status: 200, type: [TransferRecipientResponse] })
  async recipients(
    @Query() query: TransferRecipientsQueryDto,
    @CurrentUser() user: AuthUser,
    @Scope() scope: BranchScope,
  ): Promise<PaginatedResult<TransferRecipientResponse>> {
    const page = await this.transfers.recipientsFor(query, user, scope);

    return page.map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      subtitle: recipient.subtitle ?? null,
    }));
  }

  @Post('validate')
  @HttpCode(200)
  @Permissions(Perm.TRANSFERS_CREATE)
  @ApiOperation({ summary: 'Dry run: every create check, no writes' })
  @ApiResponse({ status: 200, type: TransferValidationResponse })
  async validate(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TransferValidationResponse> {
    return this.transfers.validate(dto, user);
  }

  @Post()
  @Idempotent()
  @Permissions(Perm.TRANSFERS_CREATE)
  @ApiOperation({ summary: 'Create a hand-off; machines go IN_TRANSIT until confirmed' })
  @ApiResponse({ status: 201, type: TransferResponse })
  @ApiResponse({ status: 409, description: 'MACHINE_ALREADY_IN_TRANSIT' })
  @ApiResponse({ status: 422, description: 'INVALID_MACHINE_STATUS / NOT_IN_YOUR_CUSTODY' })
  async create(
    @Body() dto: CreateTransferDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<TransferResponse> {
    return toTransferResponse(await this.transfers.create(dto, actorOf(req)), locale);
  }

  @Get(':id')
  @Permissions(Perm.TRANSFERS_READ)
  @BranchScoped(Perm.TRANSFERS_READ_ALL)
  @ApiOperation({ summary: 'Get one transfer with items, photos and signatures' })
  @ApiResponse({ status: 200, type: TransferResponse })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Scope() scope: BranchScope,
    @CurrentUser() user: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<TransferResponse> {
    return toTransferResponse(await this.transfers.findById(id, scope, user), locale);
  }

  @Get(':id/signatures/:signatureId/media')
  @Permissions(Perm.TRANSFERS_READ)
  @BranchScoped(Perm.TRANSFERS_READ_ALL)
  @ApiOperation({
    summary: "A signed URL for one signature's drawn image, for whoever can read this transfer",
  })
  @ApiResponse({ status: 200, type: TransferSignatureMediaResponse })
  @ApiResponse({ status: 404, description: 'MEDIA_NOT_FOUND — no drawn image on this signature' })
  async signatureMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('signatureId', ParseUUIDPipe) signatureId: string,
    @Scope() scope: BranchScope,
    @CurrentUser() user: AuthUser,
  ): Promise<TransferSignatureMediaResponse> {
    const { url, expiresAt, mimeType } = await this.transfers.signatureMedia(
      id,
      signatureId,
      scope,
      user,
    );
    return { url, expiresAt: expiresAt.toISOString(), mimeType };
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @Idempotent()
  @Permissions(Perm.TRANSFERS_CONFIRM)
  @ApiOperation({ summary: 'Sign for the delivery; the receiver may correct what he actually got' })
  @ApiResponse({ status: 200, type: TransferResponse })
  @ApiResponse({ status: 409, description: 'PAYLOAD_CHANGED — re-read before signing' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmTransferDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<TransferResponse> {
    return toTransferResponse(await this.transfers.confirm(id, dto, actorOf(req)), locale);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Permissions(Perm.TRANSFERS_REJECT)
  @ApiOperation({ summary: 'Refuse the whole delivery; every machine reverts to its prior status' })
  @ApiResponse({ status: 200, type: TransferResponse })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<TransferResponse> {
    return toTransferResponse(await this.transfers.reject(id, dto, actorOf(req)), locale);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Permissions(Perm.TRANSFERS_CANCEL)
  @ApiOperation({ summary: 'Sender withdraws a pending transfer within the cancel window' })
  @ApiResponse({ status: 200, type: TransferResponse })
  @ApiResponse({ status: 422, description: 'CANCEL_WINDOW_EXPIRED' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
    @Req() req: RequestContext,
    @ReqLocale() locale: Locale,
  ): Promise<TransferResponse> {
    return toTransferResponse(await this.transfers.cancel(id, dto, actorOf(req)), locale);
  }
}

/** Signatures record where they were taken from; the rest of the request is already validated. */
function actorOf(req: RequestContext): TransferActor {
  return { user: req.user!, ipAddress: req.ip ?? null };
}
