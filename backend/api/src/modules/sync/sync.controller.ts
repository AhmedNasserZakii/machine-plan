import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Locale } from 'src/common/constants/locales';
import { CurrentUser, Idempotent, ReqLocale } from 'src/common/decorators';
import { AuthUser, RequestContext } from 'src/common/types/request.types';
import {
  SyncBatchResponse,
  SyncBootstrapResponse,
  SyncDeltaResponse,
  SyncStatusResponse,
} from './dto/responses/sync.response';
import { SyncBatchDto, SyncDeltaQueryDto } from './dto/sync.dto';
import { SyncBatchService } from './sync-batch.service';
import { SyncService } from './sync.service';

/**
 * What the mobile app calls to work with no connection (`20`).
 *
 * Deliberately not `@Permissions`-gated: every caller is entitled to *their own* offline
 * working set, and the answer is narrowed inside the service instead — a representative gets
 * the machines in his hands and the shops he registered, and the finance collections come back
 * empty for anyone without `finance.read` rather than failing his whole sync with a 403.
 */
@ApiTags('sync')
@ApiBearerAuth('access-token')
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly batch: SyncBatchService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Server time and schema version; the pre-flight for every sync' })
  @ApiResponse({ status: 200, type: SyncStatusResponse })
  status(): SyncStatusResponse {
    return this.sync.status();
  }

  @Get('bootstrap')
  @ApiOperation({
    summary: 'Everything the app needs to work offline, for a first launch',
    description:
      'Localized to the request locale. Unpaginated by design: this is the whole local ' +
      'database the device is about to build, and it is scoped rather than paged.',
  })
  @ApiResponse({ status: 200, type: SyncBootstrapResponse })
  bootstrap(
    @CurrentUser() user: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<SyncBootstrapResponse> {
    return this.sync.bootstrap(user, locale);
  }

  @Get('delta')
  @ApiOperation({
    summary: 'Everything that changed since a cursor, plus what to purge',
    description:
      'Pass the `nextSince` from the previous call — never the device clock, which is exactly ' +
      'what would silently skip rows written while the phone was fast.',
  })
  @ApiResponse({ status: 200, type: SyncDeltaResponse })
  delta(
    @Query() query: SyncDeltaQueryDto,
    @CurrentUser() user: AuthUser,
    @ReqLocale() locale: Locale,
  ): Promise<SyncDeltaResponse> {
    return this.sync.delta(new Date(query.since), user, locale);
  }

  // 200, not 201: the batch itself creates nothing. What it reports is per operation, and the
  // report is a success even when every item in it failed.
  @Post('batch')
  @HttpCode(200)
  @Idempotent()
  // `4.2`: 20/minute/user. Batches carry many operations each, so this is a coarser ceiling
  // than `default` — a device retrying an unconfirmed batch every few seconds must not be able
  // to spend the *general* 300/minute allowance on this one endpoint alone.
  @Throttle({ 'sync-batch': { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Push a queue of offline operations',
    description:
      'Processed in the order given, each in its own transaction. One failure never rolls back ' +
      'the rest; every operation is reported individually with what the client should do about ' +
      'it. Permissions are checked per operation, since one batch may mix kinds.',
  })
  @ApiResponse({ status: 200, type: SyncBatchResponse })
  batchPush(
    @Body() dto: SyncBatchDto,
    @CurrentUser() user: AuthUser,
    @ReqLocale() locale: Locale,
    @Req() req: RequestContext,
  ): Promise<SyncBatchResponse> {
    return this.batch.process(dto, { user, locale, ipAddress: req.ip ?? null });
  }
}
