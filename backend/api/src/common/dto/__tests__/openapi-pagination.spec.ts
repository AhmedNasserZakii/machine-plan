import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GET routes that must stay unpaginated, matching PAGINATION_PLAN.md §1.3.
 * A new `@Get()` that returns a growing list has to declare `page`+`limit`, `cursor`, or
 * `since`+`limit` — or be added here with a reason.
 */
const UNPAGINATED_GETS = new Set([
  // Single resource by id
  '/auth/me',
  '/branches/{id}',
  '/finance/budgets/{id}',
  '/finance/categories/{id}',
  '/finance/categories/{id}/breadcrumb',
  '/finance/transactions/{id}',
  '/machines/{id}',
  '/machines/lookup',
  '/machines/by-serial/{serial}',
  '/maintenance-orders/{id}',
  '/media/{id}',
  '/media/blob',
  '/merchants/{id}',
  '/reports/jobs/{id}',
  '/roles/{id}',
  '/settings/{key}',
  '/transfers/{id}',
  '/transfers/{id}/signatures/{signatureId}/media',
  '/users/{id}',
  '/users/{id}/permissions',
  '/violations/{id}',
  '/warehouses/{id}',
  '/machines/{id}/decommission',
  // Aggregate / scalar
  '/branches/{id}/summary',
  '/finance/summary',
  '/finance/by-category',
  '/machines/{id}/cost-summary',
  '/notifications/unread-count',
  '/users/{id}/violations/summary',
  '/sync/status',
  // Fixed catalogue
  '/permissions',
  '/reports',
  '/roles',
  '/settings',
  '/transfers/creatable-types',
  '/notification-preferences',
  // Seeded lookup (capped at MAX_LIMIT, not paged)
  '/payment-methods',
  '/violation-types',
  '/maintenance-locations',
  '/decommission-reasons',
  '/machine-types',
  // Tree
  '/finance/categories/tree',
  // Bounded chain
  '/machines/{id}/replacement-chain',
  // Deliberately whole-database, with truncated flags
  '/sync/bootstrap',
]);

interface OpenApi {
  paths: Record<string, { get?: { parameters?: Array<{ name?: string }> } }>;
}

function isPaged(names: string[]): boolean {
  const has = (name: string): boolean => names.includes(name);
  return (has('page') && has('limit')) || has('cursor') || (has('since') && has('limit'));
}

describe('OpenAPI GET pagination guardrail', () => {
  const spec = JSON.parse(
    readFileSync(join(__dirname, '../../../../openapi.json'), 'utf8'),
  ) as OpenApi;

  it('every GET is either paginated or on the §1.3 allowlist', () => {
    const bare: string[] = [];
    const unknownAllow: string[] = [];

    for (const [rawPath, ops] of Object.entries(spec.paths)) {
      if (!ops.get) continue;

      const path = rawPath.replace(/^\/api\/v1/, '') || '/';
      const names = (ops.get.parameters ?? []).map((parameter) => parameter.name ?? '');
      const paged = isPaged(names);
      const allowed = UNPAGINATED_GETS.has(path);

      if (!paged && !allowed) bare.push(path);
      if (paged && allowed) unknownAllow.push(path);
    }

    expect(bare).toEqual([]);
    expect(unknownAllow).toEqual([]);
  });
});
