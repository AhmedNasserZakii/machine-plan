import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const repoRoot = join(webRoot, '..');
const mobileDir = join(repoRoot, 'mobile-app/assets/translations');
const webDir = join(webRoot, 'src/i18n/web');
const outDir = join(webRoot, 'src/i18n/messages');

const check = process.argv.includes('--check');

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function assertSameLeaves(a: Record<string, unknown>, b: Record<string, unknown>, label: string) {
  const aKeys = leafPaths(a).sort();
  const bKeys = leafPaths(b).sort();
  const missingInB = aKeys.filter((k) => !bKeys.includes(k));
  const missingInA = bKeys.filter((k) => !aKeys.includes(k));
  if (missingInA.length || missingInB.length) {
    throw new Error(
      `${label} ar/en key mismatch.\n  missing in ar: ${missingInA.join(', ') || '—'}\n  missing in en: ${missingInB.join(', ') || '—'}`,
    );
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const mobileAr = readJson(join(mobileDir, 'ar.json'));
const mobileEn = readJson(join(mobileDir, 'en.json'));
const webAr = readJson(join(webDir, 'ar.json'));
const webEn = readJson(join(webDir, 'en.json'));

if ('shared' in webAr || 'shared' in webEn) {
  throw new Error('src/i18n/web/* must not contain a `shared` key — that namespace is generated from mobile.');
}

const mobileArKeys = Object.keys(mobileAr).sort();
const mobileEnKeys = Object.keys(mobileEn).sort();
if (mobileArKeys.join('\n') !== mobileEnKeys.join('\n')) {
  throw new Error('mobile translation files have different top-level keys');
}
assertSameLeaves(webAr, webEn, 'web namespaces');

const outAr = { shared: mobileAr, ...webAr };
const outEn = { shared: mobileEn, ...webEn };

if (check) {
  const existingArPath = join(outDir, 'ar.json');
  const existingEnPath = join(outDir, 'en.json');
  if (!existsSync(existingArPath) || !existsSync(existingEnPath)) {
    throw new Error('Generated i18n messages are missing. Run `npm run i18n:sync`.');
  }
  const existingAr = readJson(existingArPath);
  const existingEn = readJson(existingEnPath);
  if (!deepEqual(existingAr, outAr) || !deepEqual(existingEn, outEn)) {
    throw new Error(
      'i18n messages are stale or `shared.*` was hand-edited. Run `npm run i18n:sync`.',
    );
  }
  console.log('i18n check passed.');
  process.exit(0);
}

writeFileSync(join(outDir, 'ar.json'), `${JSON.stringify(outAr, null, 2)}\n`);
writeFileSync(join(outDir, 'en.json'), `${JSON.stringify(outEn, null, 2)}\n`);
console.log(`Wrote ${relative(webRoot, outDir)}/{ar,en}.json`);
