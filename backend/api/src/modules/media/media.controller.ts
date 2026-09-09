import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser, Public, SkipVersionCheck } from 'src/common/decorators';
import { ErrorCode } from 'src/common/constants/error-codes';
import { MEDIA_PURPOSE_RULES } from 'src/common/enums/operations.enum';
import { AppException } from 'src/common/errors';
import { AuthUser } from 'src/common/types/request.types';
import { Perm } from 'src/modules/roles/permissions.catalogue';
import {
  BlobQueryDto,
  ConfirmMediaDto,
  MediaVariantQueryDto,
  PresignMediaDto,
  UploadMediaDto,
} from './dto/media.dto';
import { MediaResponse, PresignResponse } from './dto/responses/media.response';
import { toMediaResponse } from './mappers/media.mapper';
import { MediaService } from './media.service';
import { StorageService } from './storage/storage.service';

/**
 * Static ceiling for the multipart path — decorator metadata cannot read config. It is the
 * largest any purpose allows; `assertPurposeAllows` then narrows to the real per-purpose
 * limit once the purpose is known.
 *
 * It is declared above the controller because a decorator is evaluated when the class is
 * defined, which is before any `const` that follows the class has been initialised.
 */
const ABSOLUTE_UPLOAD_MAX_BYTES = Math.max(
  ...Object.values(MEDIA_PURPOSE_RULES).map((rule) => rule.maxBytes),
);

/**
 * Media is not permission-gated beyond authentication: every field user takes hand-off photos and
 * signs. What *is* gated is reading someone else's object, which is why nothing here returns a
 * permanent URL and `/blob` only answers a signature this server issued.
 */
@ApiTags('media')
@ApiBearerAuth('access-token')
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly storage: StorageService,
  ) {}

  @Post('presign')
  // `4.2`: 100/minute/user — presign is cheap, but it is also the one write a device can retry
  // in a tight loop on a flaky connection without any of the idempotency protection a real
  // upload gets, so it earns its own ceiling above `default`.
  @Throttle({ 'media-presign': { limit: 100, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reserve a storage key and get a direct-upload URL' })
  @ApiResponse({ status: 201, type: PresignResponse })
  @ApiResponse({ status: 413, description: 'UPLOAD_TOO_LARGE' })
  @ApiResponse({ status: 415, description: 'UNSUPPORTED_MEDIA_TYPE' })
  async presign(
    @Body() dto: PresignMediaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PresignResponse> {
    const result = await this.media.presign(dto, user.id);

    return {
      mediaId: result.media.id,
      storageKey: result.media.storageKey,
      uploadUrl: result.uploadUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register an uploaded object after verifying its size and checksum' })
  @ApiResponse({ status: 200, type: MediaResponse })
  @ApiResponse({ status: 422, description: 'MEDIA_NOT_CONFIRMED / CHECKSUM_MISMATCH' })
  async confirm(
    @Body() dto: ConfirmMediaDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MediaResponse> {
    return toMediaResponse(await this.media.confirm(dto.mediaId, user.id));
  }

  @Post('upload')
  // Multer buffers into memory and defaults to no size limit, so the ceiling has to be set
  // here — `assertPurposeAllows` only sees the file after the whole body is already in RAM.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: ABSOLUTE_UPLOAD_MAX_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Direct multipart upload, for networks that block presigned URLs' })
  @ApiResponse({ status: 201, type: MediaResponse })
  @ApiResponse({ status: 413, description: 'UPLOAD_TOO_LARGE' })
  async upload(
    @Body() dto: UploadMediaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ): Promise<MediaResponse> {
    if (!file) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, {
        details: [{ field: 'file', constraint: 'required' }],
      });
    }

    return toMediaResponse(await this.media.upload(dto.purpose, file, user.id, dto.clientUuid));
  }

  /**
   * The bytes themselves. Public by design — the signature in the query string *is* the
   * authorization, which is what makes the URL usable by an `<img>` tag and a background
   * uploader alike.
   */
  @Public()
  @SkipVersionCheck()
  @Get('blob')
  @ApiOperation({ summary: 'Fetch object bytes with a signed URL issued by this server' })
  async readBlob(@Query() query: BlobQueryDto, @Res() res: Response): Promise<void> {
    const valid = this.storage.verifySignature(
      query.key,
      'GET',
      Number(query.expires),
      query.signature,
    );

    if (!valid) throw AppException.forbidden(ErrorCode.INSUFFICIENT_PERMISSIONS);

    const body = await this.storage.get(query.key);
    if (!body) throw AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);

    // Keys are server-generated with the extension the mime type implies, so the round trip is
    // lossless and an `<img src>` pointed at this URL renders instead of downloading.
    res.setHeader('Content-Type', mimeForKey(query.key));
    res.setHeader('Content-Length', String(body.byteLength));
    res.setHeader('Cache-Control', 'private, max-age=300');
    // Never let a browser re-interpret stored bytes as something more dangerous than the
    // type we declare, and never render them as a top-level document on this origin.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.end(body);
  }

  /** The local storage adapter's PUT target. With S3 configured the client uploads to S3 instead. */
  @Public()
  @SkipVersionCheck()
  @Put('blob')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upload object bytes to a signed URL issued by this server' })
  @ApiResponse({ status: 413, description: 'UPLOAD_TOO_LARGE' })
  async writeBlob(@Query() query: BlobQueryDto, @Req() req: Request): Promise<void> {
    const valid = this.storage.verifySignature(
      query.key,
      'PUT',
      Number(query.expires),
      query.signature,
    );

    if (!valid) throw AppException.forbidden(ErrorCode.INSUFFICIENT_PERMISSIONS);

    // A presigned PUT stays valid for its full TTL. Once the object is confirmed its bytes
    // are evidence, so the key becomes write-once rather than replaceable.
    if (await this.media.isConfirmedKey(query.key)) {
      throw AppException.conflict(ErrorCode.MEDIA_ALREADY_USED);
    }

    const maxBytes = this.media.maxBytesForKey(query.key);
    await this.storage.put(query.key, await readBody(req, maxBytes));
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one media record with a short-lived signed URL',
    description: '`?variant=thumb` for the 320px WebP variant, where one exists.',
  })
  @ApiResponse({ status: 200, type: MediaResponse })
  @ApiResponse({ status: 404, description: 'MEDIA_NOT_FOUND — also returned for others’ media' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MediaVariantQueryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MediaResponse> {
    const { media, url, expiresAt } = await this.media.signedUrl(
      id,
      user.id,
      user.permissions.includes(Perm.SETTINGS_MANAGE),
      query.variant,
    );
    return toMediaResponse(media, { url, expiresAt });
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete media you uploaded; settings.manage may delete any' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.media.remove(id, user.id, user.permissions.includes(Perm.SETTINGS_MANAGE));
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function mimeForKey(storageKey: string): string {
  const extension = storageKey.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/**
 * The raw-body upload path has no JSON parser in front of it, so the stream is read here.
 *
 * The cap is enforced *while* reading rather than after: the size a client declares at
 * presign is not binding on what it actually streams, and buffering an unbounded body
 * first would be the denial-of-service this guards against.
 */
function readBody(req: Request, maxBytes: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Promise.reject(tooLarge(maxBytes));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    req.on('data', (chunk: Buffer) => {
      received += chunk.byteLength;
      if (received > maxBytes) {
        req.destroy();
        reject(tooLarge(maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function tooLarge(maxBytes: number): AppException {
  return new AppException(ErrorCode.UPLOAD_TOO_LARGE, {
    status: 413,
    params: { maxMb: Math.round((maxBytes / (1024 * 1024)) * 100) / 100 },
  });
}
