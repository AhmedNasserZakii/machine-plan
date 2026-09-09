import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { ErrorCode } from '../constants/error-codes';
import { AppException } from '../errors';
import { sha256Object } from '../utils';
import { IdempotencyKeyRecord, IdempotencyStatus, StoredResponse } from './idempotency-key.entity';

/** Keys live 7 days — long enough for any realistic offline gap (`20`, mechanism 2). */
export const IDEMPOTENCY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long a reservation may sit `IN_PROGRESS` before another attempt may take it over. A
 * process killed mid-handler leaves its row behind, and without a takeover window that key
 * would answer `IDEMPOTENT_REQUEST_IN_PROGRESS` forever — the one outcome a client cannot
 * resolve on its own.
 */
export const IN_FLIGHT_TAKEOVER_MS = 2 * 60 * 1000;

export interface IdempotencyRequest {
  key: string;
  userId: string;
  endpoint: string;
  body: unknown;
}

export type IdempotencyOutcome =
  | { kind: 'PROCEED'; recordId: string }
  | { kind: 'REPLAY'; statusCode: number | null; body: StoredResponse | null };

/**
 * The store behind `IdempotencyInterceptor`, kept separate from it so a non-HTTP caller can
 * reserve a key the same way.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKeyRecord)
    private readonly records: Repository<IdempotencyKeyRecord>,
  ) {}

  /**
   * Claims the key for this attempt, or reports what the first attempt already answered.
   *
   * The claim is an `INSERT ... ON CONFLICT DO NOTHING`, so the database arbitrates between two
   * concurrent requests. A read-then-write in application code would let both pass on a cold key,
   * which is precisely the duplicate this whole mechanism exists to prevent.
   */
  async begin(request: IdempotencyRequest): Promise<IdempotencyOutcome> {
    const requestHash = sha256Object(request.body ?? null);
    const now = new Date();

    const inserted = await this.records
      .createQueryBuilder()
      .insert()
      .into(IdempotencyKeyRecord)
      .values({
        key: request.key,
        userId: request.userId,
        endpoint: request.endpoint,
        requestHash,
        status: IdempotencyStatus.IN_PROGRESS,
        expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
      })
      .orIgnore()
      .returning('id')
      .execute();

    const claimed = (inserted.raw as { id: string }[]).at(0);
    if (claimed) {
      // Bounded growth without a scheduler: every fresh key pays for the expired keys of the
      // caller that created it, and the delete rides the same `(user_id, key)` index.
      await this.records.delete({ userId: request.userId, expiresAt: LessThanOrEqual(now) });
      return { kind: 'PROCEED', recordId: claimed.id };
    }

    const existing = await this.records.findOne({
      where: { userId: request.userId, key: request.key },
    });

    // Deleted between the rejected insert and this read. The only thing that deletes rows is
    // the prune above, so the key is free again and the client's retry will claim it.
    if (!existing) {
      throw AppException.conflict(ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS);
    }

    // Past its 7 days the row is no longer an answer, so the key may be spent again — on a
    // different endpoint and a different body than the first time.
    if (existing.expiresAt.getTime() <= now.getTime()) {
      if (await this.reclaim(existing.id, request, requestHash, 'expires_at <= :cutoff', now)) {
        return { kind: 'PROCEED', recordId: existing.id };
      }
      throw AppException.conflict(ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS);
    }

    if (existing.endpoint !== request.endpoint || existing.requestHash !== requestHash) {
      throw AppException.conflict(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    }

    if (existing.status === IdempotencyStatus.COMPLETED) {
      return { kind: 'REPLAY', statusCode: existing.statusCode, body: existing.responseBody };
    }

    const abandonedSince = new Date(now.getTime() - IN_FLIGHT_TAKEOVER_MS);
    if (
      existing.updatedAt.getTime() < abandonedSince.getTime() &&
      (await this.reclaim(
        existing.id,
        request,
        requestHash,
        'updated_at < :cutoff',
        abandonedSince,
      ))
    ) {
      return { kind: 'PROCEED', recordId: existing.id };
    }

    throw AppException.conflict(ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS);
  }

  /** Attaches the response every later replay of this key will be served. */
  async complete(recordId: string, statusCode: number, body: StoredResponse): Promise<void> {
    await this.records.update(recordId, {
      status: IdempotencyStatus.COMPLETED,
      statusCode,
      responseBody: body,
      completedAt: new Date(),
    });
  }

  /**
   * Drops the reservation after a failed attempt so the client may retry the same key once
   * whatever went wrong is fixed. A failure is not an answer worth replaying.
   */
  async release(recordId: string): Promise<void> {
    await this.records.delete(recordId);
  }

  /**
   * Turns an expired or abandoned row back into a fresh reservation. The `where` clause repeats
   * the condition the caller read, so of two requests that both saw the same dead row only one
   * inherits it.
   */
  private async reclaim(
    recordId: string,
    request: IdempotencyRequest,
    requestHash: string,
    condition: string,
    cutoff: Date,
  ): Promise<boolean> {
    const result = await this.records
      .createQueryBuilder()
      .update(IdempotencyKeyRecord)
      .set({
        endpoint: request.endpoint,
        requestHash,
        status: IdempotencyStatus.IN_PROGRESS,
        statusCode: null,
        responseBody: null,
        completedAt: null,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      })
      .where('id = :id', { id: recordId })
      .andWhere(condition, { cutoff })
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
