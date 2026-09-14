import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AuditLog } from 'src/common/audit';
import { decodeCursor, encodeCursor, KeysetCursor } from 'src/common/dto/cursor.util';
import { CursorResult } from 'src/common/dto/paginated-result';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

/**
 * Read-only: nothing in this module ever writes a row — that is `AuditService`'s job — or
 * updates/deletes one, which the database itself now refuses (`21`, tamper resistance).
 */
@Injectable()
export class AuditLogsService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async findAll(query: QueryAuditLogsDto): Promise<CursorResult<AuditLog>> {
    const qb = this.baseQuery();
    this.applyFilters(qb, query);

    return this.paginate(qb, query);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    query: QueryAuditLogsDto,
  ): Promise<CursorResult<AuditLog>> {
    const qb = this.baseQuery()
      .andWhere('log.entity_type = :entityType', { entityType })
      .andWhere('log.entity_id = :entityId', { entityId });
    this.applyFilters(qb, query);

    return this.paginate(qb, query);
  }

  async findByUser(userId: string, query: QueryAuditLogsDto): Promise<CursorResult<AuditLog>> {
    const qb = this.baseQuery().andWhere('log.user_id = :userId', { userId });
    this.applyFilters(qb, query);

    return this.paginate(qb, query);
  }

  private baseQuery(): SelectQueryBuilder<AuditLog> {
    return this.logs.createQueryBuilder('log');
  }

  private async paginate(
    qb: SelectQueryBuilder<AuditLog>,
    query: QueryAuditLogsDto,
  ): Promise<CursorResult<AuditLog>> {
    this.applyCursor(qb, decodeCursor(query.cursor));
    qb.orderBy('log.created_at', 'DESC')
      .addOrderBy('log.id', 'DESC')
      .take(query.limit + 1);

    const rows = await qb.getMany();
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);

    return new CursorResult(
      page,
      query.limit,
      rows.length > query.limit && last ? encodeCursor(last.createdAt, last.id) : null,
    );
  }

  private applyFilters(qb: SelectQueryBuilder<AuditLog>, query: QueryAuditLogsDto): void {
    if (query.userId) qb.andWhere('log.user_id = :userId', { userId: query.userId });
    if (query.action) qb.andWhere('log.action = :action', { action: query.action });
    if (query.entityType) {
      qb.andWhere('log.entity_type = :entityType', { entityType: query.entityType });
    }
    if (query.entityId) qb.andWhere('log.entity_id = :entityId', { entityId: query.entityId });
    if (query.requestId) qb.andWhere('log.request_id = :requestId', { requestId: query.requestId });
    if (query.dateFrom) qb.andWhere('log.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    if (query.dateTo) qb.andWhere('log.created_at <= :dateTo', { dateTo: query.dateTo });
  }

  /**
   * `(created_at, id) < (cursor.created_at, cursor.id)` in DESC order — the standard keyset seek,
   * expressed as a row comparison so it stays a single index scan rather than an OR of two ranges.
   */
  private applyCursor(qb: SelectQueryBuilder<AuditLog>, cursor: KeysetCursor | null): void {
    if (!cursor) return;

    qb.andWhere('(log.created_at, log.id) < (:cursorCreatedAt, :cursorId)', {
      cursorCreatedAt: cursor.occurredAt,
      cursorId: cursor.id,
    });
  }
}
