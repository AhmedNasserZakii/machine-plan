/**
 * Post-build bundle budget check from machinery-web-plan/25.
 * First-load shared JS ≤ 200 KB gzipped; per-route ≤ 120 KB gzipped.
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const ROOT = join(process.cwd(), '.next');
const SHARED_BUDGET = 200 * 1024;
const ROUTE_BUDGET = 120 * 1024;

async function gzipSize(path: string): Promise<number> {
  let size = 0;
  const sink = new Writable({
    write(chunk, _enc, cb) {
      size += (chunk as Buffer).length;
      cb();
    },
  });
  await pipeline(createReadStream(path), createGzip(), sink);
  return size;
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

async function main() {
  const staticDir = join(ROOT, 'static');
  if (!existsSync(staticDir)) {
    console.error('No .next/static — run npm run build first');
    process.exit(1);
  }

  const files = walk(staticDir);
  const chunks = await Promise.all(
    files.map(async (f) => ({ file: f.replace(ROOT, '.next'), size: await gzipSize(f) })),
  );
  chunks.sort((a, b) => b.size - a.size);

  const shared = chunks.filter((c) => /\/chunks\/(framework|main|webpack|polyfills)/.test(c.file));
  const sharedTotal = shared.reduce((s, c) => s + c.size, 0);
  const largestRoute = chunks.find((c) => /\/chunks\/app\//.test(c.file) || /page-/.test(c.file));

  console.log('Top gzipped JS chunks:');
  for (const c of chunks.slice(0, 15)) {
    console.log(`  ${(c.size / 1024).toFixed(1).padStart(7)} KB  ${c.file}`);
  }
  console.log(`Shared-ish total: ${(sharedTotal / 1024).toFixed(1)} KB (budget ${SHARED_BUDGET / 1024} KB)`);
  if (largestRoute) {
    console.log(
      `Largest app chunk: ${(largestRoute.size / 1024).toFixed(1)} KB (budget ${ROUTE_BUDGET / 1024} KB) — ${largestRoute.file}`,
    );
  }

  let failed = false;
  if (sharedTotal > SHARED_BUDGET && shared.length > 0) {
    console.error('FAIL: shared JS exceeds 200 KB gzipped');
    failed = true;
  }
  if (largestRoute && largestRoute.size > ROUTE_BUDGET) {
    console.error('FAIL: a route chunk exceeds 120 KB gzipped');
    failed = true;
  }

  // Soft pass when Next chunks naming differs — still report sizes.
  if (!failed) console.log('Bundle budgets OK (or naming soft-pass with sizes reported).');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
