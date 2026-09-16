import { describe, expect, it } from 'vitest';

import { MACHINE_STATUS_TONE, toneColorVar } from './status-tone';

describe('status tones', () => {
  it('maps representative to primary-light per Dart StatusColors', () => {
    expect(MACHINE_STATUS_TONE.WITH_REPRESENTATIVE).toBe('primary');
    expect(toneColorVar('primary', 'WITH_REPRESENTATIVE')).toBe('var(--color-primary-light)');
  });
});
