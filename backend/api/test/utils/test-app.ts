import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from 'src/app.module';
import { AppConfig } from 'src/config';
import { validationException } from 'src/common/errors';
import { AllExceptionsFilter } from 'src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from 'src/common/interceptors/response.interceptor';
import { TimeoutInterceptor } from 'src/common/interceptors/timeout.interceptor';
import { localeMiddleware } from 'src/common/middleware/locale.middleware';
import { requestContextMiddleware } from 'src/common/middleware/request-context.middleware';

export interface TestApp {
  app: INestApplication;
  server: App;
}

/**
 * Boots the real AppModule with the exact global pipeline from `main.ts`, so the suite
 * exercises the same prefix, versioning, validation errors, filters and interceptors the
 * mobile app will hit. Only `helmet`, CORS and Swagger are left out — none of them affect
 * response bodies.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

  app.use(requestContextMiddleware(), localeMiddleware());
  app.setGlobalPrefix(appConfig.apiPrefix, { exclude: ['health', 'health/ready', 'metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: validationException,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new TimeoutInterceptor(appConfig.requestTimeoutMs),
    new ResponseInterceptor(),
  );

  // Bind a real ephemeral port instead of only `init()`. Handed a server that is not
  // listening, Supertest binds and closes one per request, and that churn intermittently
  // loses a request — it surfaces as a socket hang up or, worse, a bogus 404 on a route
  // that plainly exists. Listening once per suite removes the race.
  await app.listen(0);

  return { app, server: app.getHttpServer() as App };
}
