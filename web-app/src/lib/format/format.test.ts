import { describe, expect, it } from 'vitest';

import { formatMoney, formatNumber, formatPhone } from './index';

describe('format', () => {
  it('uses Latin digits in both locales', () => {
    expect(formatNumber(12500, 'ar')).toMatch(/12/);
    expect(formatNumber(12500, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatMoney(12500, 'ar')).toContain('ج.م');
    expect(formatMoney(12500, 'en')).toContain('EGP');
    expect(formatMoney(-10, 'en')).toContain('−');
    expect(formatPhone('010 1234 5678')).toBe('01012345678');
  });
});
