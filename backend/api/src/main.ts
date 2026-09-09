import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig, SentryConfig } from './config';
import { initSentry } from './common/observability/sentry';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validationException } from './common/errors';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { setupSwagger } from './bootstrap/swagger.setup';
import { localeMiddleware } from './common/middleware/locale.middleware';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  initSentry(config.getOrThrow<SentryConfig>('sentry'));

  app.useLogger(app.get(Logger));
  app.flushLogs();

  // Behind a reverse proxy, `request.ip` must be the client's address and not the
  // proxy's — otherwise the phone+IP login throttle locks out whole populations at once.
  if (appConfig.trustProxy !== false) {
    app.set('trust proxy', appConfig.trustProxy);
  }

  app.use(helmet());
  app.use(requestContextMiddleware(), localeMiddleware());
  app.enableCors({
    origin: appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : false,
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept-Language',
      'Idempotency-Key',
      'X-Client-Version',
      'X-Device-Id',
      'X-Request-Id',
    ],
  });

  // `/health` and `/metrics` sit outside the versioned API surface.
  app.setGlobalPrefix(appConfig.apiPrefix, { exclude: ['health', 'health/ready', 'metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Reports the offending field per `22-api-conventions-errors.md` instead of the
      // default flat message list, which drops the property path.
      exceptionFactory: validationException,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new TimeoutInterceptor(appConfig.requestTimeoutMs),
    new ResponseInterceptor(),
  );

  // The docs UI publishes the full API surface and permission model — never in production.
  if (!appConfig.isProduction) {
    setupSwagger(app, true);
  }

  app.enableShutdownHooks();

  await app.listen(appConfig.port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    `API listening on port ${appConfig.port} — docs at /api/docs, routes under /${appConfig.apiPrefix}/v1`,
  );
}

void bootstrap();
