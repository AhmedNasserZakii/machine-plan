import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { endpoints, flattenEndpointTemplates } from './endpoints';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function normalize(path: string): string {
  return path.replace(/^\/api\/v1\//, '').replace(/\{[^}]+\}/g, '{id}');
}

describe('endpoints catalogue', () => {
  it('covers every OpenAPI path', () => {
    const spec = JSON.parse(readFileSync(join(root, 'backend/api/openapi.json'), 'utf8')) as {
      paths: Record<string, unknown>;
    };
    const specPaths = Object.keys(spec.paths).map(normalize).sort();
    const clientPaths = flattenEndpointTemplates(endpoints).map(normalize).sort();
    const missing = specPaths.filter((path) => !clientPaths.includes(path));
    expect(missing).toEqual([]);
  });
});
