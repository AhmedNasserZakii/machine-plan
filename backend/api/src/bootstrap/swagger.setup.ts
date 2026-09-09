import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORTED_LOCALES } from 'src/common/constants/locales';

export const SWAGGER_PATH = 'api/docs';

/**
 * Extracted from `setupSwagger` so `scripts/check-openapi-drift.ts` (`5.1`) can build the exact
 * same document — including the same `operationIdFactory` — without also mounting Swagger UI or
 * touching `openapi.json` on disk.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Machine Lifecycle & Finance API')
    .setDescription(
      'Machine custody tracking and company finance. All responses use the `{ success, data, meta }` envelope; ' +
        'errors use `{ success: false, error: { code, message, requestId } }` with stable `code` values.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addGlobalParameters({
      name: 'Accept-Language',
      in: 'header',
      required: false,
      schema: { type: 'string', enum: [...SUPPORTED_LOCALES], default: 'ar' },
      description: 'Response locale. Defaults to ar.',
    })
    .build();

  return SwaggerModule.createDocument(app, config, { operationIdFactory: (_c, m) => m });
}

/**
 * Mounts Swagger UI and writes `openapi.json` to the repo root so the Flutter team can
 * generate models from a committed spec (`22-api-conventions-errors.md`).
 */
export function setupSwagger(app: INestApplication, writeSpecToDisk: boolean): void {
  const document = buildOpenApiDocument(app);

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });

  if (writeSpecToDisk) {
    writeFileSync(join(process.cwd(), 'openapi.json'), JSON.stringify(document, null, 2));
  }
}
