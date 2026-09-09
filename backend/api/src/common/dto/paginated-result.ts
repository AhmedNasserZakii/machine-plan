import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total: number;
  @ApiProperty() totalPages: number;
  @ApiProperty() hasNext: boolean;
}

/**
 * Returned by services for paginated endpoints. `ResponseInterceptor` unwraps it into
 * `{ success, data, meta }`.
 */
export class PaginatedResult<T> {
  readonly items: T[];
  readonly meta: PaginationMeta;

  constructor(items: T[], total: number, page: number, limit: number) {
    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    this.items = items;
    this.meta = { page, limit, total, totalPages, hasNext: page < totalPages };
  }

  /** Applies a mapper to each item while keeping the computed meta. */
  map<R>(mapper: (item: T) => R): PaginatedResult<R> {
    return new PaginatedResult<R>(
      this.items.map(mapper),
      this.meta.total,
      this.meta.page,
      this.meta.limit,
    );
  }
}

export class CursorMeta {
  @ApiProperty() limit: number;
  @ApiProperty({ nullable: true }) nextCursor: string | null;
  @ApiProperty() hasNext: boolean;
}

/** Keyset pagination, used by sync and report endpoints. */
export class CursorResult<T> {
  readonly items: T[];
  readonly meta: CursorMeta;

  constructor(items: T[], limit: number, nextCursor: string | null) {
    this.items = items;
    this.meta = { limit, nextCursor, hasNext: nextCursor !== null };
  }

  /** Applies a mapper to each item while keeping the cursor. */
  map<R>(mapper: (item: T) => R): CursorResult<R> {
    return new CursorResult<R>(this.items.map(mapper), this.meta.limit, this.meta.nextCursor);
  }
}
