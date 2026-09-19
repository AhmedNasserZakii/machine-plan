import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { endpoints, flattenEndpointTemplates } from './endpoints';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function normalize(path: string): string {
  return path.replace(/^\/api\/v1\//, '').replace(/\{[^}]+\}/g, '{id}');
}

function specPaths(): string[] {
  const spec = JSON.parse(readFileSync(join(root, 'backend/api/openapi.json'), 'utf8')) as {
    paths: Record<string, unknown>;
  };
  return Object.keys(spec.paths).map(normalize).sort();
}

describe('endpoints catalogue', () => {
  it('covers every OpenAPI path', () => {
    const clientPaths = flattenEndpointTemplates(endpoints).map(normalize).sort();
    const missing = specPaths().filter((path) => !clientPaths.includes(path));
    expect(missing).toEqual([]);
  });

  // The other direction. Without this, a catalogue entry can name a route the API does not
  // serve — a rename on the backend, or a path typed from memory — and nothing fails until a
  // user hits the 404 at runtime.
  it('names no path the API does not serve', () => {
    const known = new Set(specPaths());
    const unknown = flattenEndpointTemplates(endpoints)
      .map(normalize)
      .filter((path) => !known.has(path))
      .sort();
    expect(unknown).toEqual([]);
  });
});
