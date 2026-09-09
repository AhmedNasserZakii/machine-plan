import { PaginatedResult } from '../paginated-result';

describe('PaginatedResult', () => {
  it('computes totalPages and hasNext for a middle page', () => {
    const result = new PaginatedResult([1, 2], 143, 1, 20);

    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 143,
      totalPages: 8,
      hasNext: true,
    });
  });

  it('reports hasNext false on the last page', () => {
    expect(new PaginatedResult([1], 143, 8, 20).meta.hasNext).toBe(false);
  });

  it('handles an empty result set', () => {
    const result = new PaginatedResult([], 0, 1, 20);

    expect(result.meta.totalPages).toBe(0);
    expect(result.meta.hasNext).toBe(false);
  });

  it('keeps meta intact when mapping items', () => {
    const mapped = new PaginatedResult([1, 2], 143, 2, 20).map((n) => ({ value: n }));

    expect(mapped.items).toEqual([{ value: 1 }, { value: 2 }]);
    expect(mapped.meta.total).toBe(143);
    expect(mapped.meta.page).toBe(2);
  });
});
