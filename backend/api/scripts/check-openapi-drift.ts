/**
 * `5.1`: fails when the committed `openapi.json` no longer matches what the running app would
 * generate — a controller/DTO change that nobody regenerated the spec for.
 *
 * Builds the document the exact way `main.ts` does (prefix, then versioning, then
 * `buildOpenApiDocument`) without booting an HTTP listener or mounting Swagger UI, and diffs it
 * against the committed file. Run via `npm run check:openapi` (wired into CI as its own step, so
 * a drift failure reads as "OpenAPI spec is out of date" rather than a cryptic test failure), or
 * `npm run docs:generate` to write the regenerated spec over the committed one — the only
 * supported way to update it; `setupSwagger`'s own disk write only fires from a real `main.ts`
 * boot outside production, which nothing in this repo's test/CI path does.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { buildOpenApiDocument } from '../src/bootstrap/swagger.setup';
import { AppConfig } from '../src/config';
import { AppModule } from '../src/app.module';

async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

  app.setGlobalPrefix(appConfig.apiPrefix, { exclude: ['health', 'health/ready', 'metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();

  const generated = buildOpenApiDocument(app);
  await app.close();

  const specPath = join(__dirname, '..', 'openapi.json');
  const generatedJson = JSON.stringify(generated, null, 2);

  if (process.argv.includes('--write')) {
    writeFileSync(specPath, generatedJson);
    console.log('openapi.json regenerated.');
    return;
  }

  const committed: unknown = JSON.parse(readFileSync(specPath, 'utf-8'));
  const committedJson = JSON.stringify(committed, null, 2);

  if (generatedJson !== committedJson) {
    console.error(
      'openapi.json is out of date — run `npm run docs:generate` and commit the result.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('openapi.json matches the running application.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
