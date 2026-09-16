import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { P } from './permissions';

describe('P catalogue', () => {
  it('matches permission_keys.dart values', () => {
    const dart = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../../mobile-app/lib/core/permissions/permission_keys.dart'),
      'utf8',
    );
    const dartValues = [...dart.matchAll(/static const String \w+ = '([^']+)';/g)].map((m) => m[1]);
    const tsValues = Object.values(P);
    for (const value of dartValues) {
      expect(tsValues).toContain(value);
    }
    expect(tsValues).toHaveLength(dartValues.length);
  });
});
