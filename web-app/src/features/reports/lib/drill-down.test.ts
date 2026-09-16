import { describe, expect, it } from 'vitest';

import { configBySlug, slugFromCataloguePath } from '../model/config';
import { drillDownHref } from './drill-down';

describe('reports slug mapping', () => {
  it('maps catalogue paths to viewer slugs', () => {
    expect(slugFromCataloguePath('/reports/machines/inventory')).toBe('machines-inventory');
    expect(slugFromCataloguePath('reports/finance/pnl')).toBe('finance-pnl');
    expect(slugFromCataloguePath('/reports/machines/{id}/lifecycle')).toBe('machines-lifecycle');
  });

  it('has seventeen report configs', () => {
    expect(
      [
        'machines-inventory',
        'machines-custody',
        'machines-costs',
        'machines-idle',
        'machines-warranty',
        'machines-lifecycle',
        'transfers',
        'transfers-pending',
        'maintenance',
        'violations',
        'merchants',
        'representatives',
        'branches-comparison',
        'finance-expenses',
        'finance-income',
        'finance-pnl',
        'finance-budgets',
      ].every((slug) => configBySlug(slug)),
    ).toBe(true);
  });
});

describe('drillDownHref', () => {
  it('links machine inventory rows by id', () => {
    const config = configBySlug('machines-inventory')!;
    expect(drillDownHref(config, { id: 'm1', serial: 'S1' })).toBe('/machines/m1');
  });

  it('falls back to serial search when id is missing', () => {
    const config = configBySlug('machines-custody')!;
    expect(drillDownHref(config, { serial: 'ABC' })).toBe('/machines?search=ABC');
  });
});
