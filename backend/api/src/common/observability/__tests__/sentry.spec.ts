import * as Sentry from '@sentry/node';
import { SentryConfig } from 'src/config/sentry.config';
import { captureError, initSentry } from '../sentry';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

function config(overrides: Partial<SentryConfig> = {}): SentryConfig {
  return { enabled: false, dsn: null, environment: 'test', tracesSampleRate: 0, ...overrides };
}

/**
 * `initSentry`/`captureError` share module-level `initialized` state on purpose (`../sentry.ts`
 * — call sites should not each need their own enabled/disabled guard). That is exactly what a
 * test needs to reset between cases, so each "before init" assertion runs against a fresh copy
 * of the module rather than one a previous test already initialized.
 */
function freshModule(): { initSentry: typeof initSentry; captureError: typeof captureError } {
  let fresh!: { initSentry: typeof initSentry; captureError: typeof captureError };
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    fresh = require('../sentry');
  });
  return fresh;
}

describe('sentry observability', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initSentry', () => {
    it('does nothing when disabled', () => {
      freshModule().initSentry(config({ enabled: false }));

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('does nothing when enabled but dsn is missing', () => {
      freshModule().initSentry(config({ enabled: true, dsn: null }));

      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('initializes the SDK with the configured dsn/environment/sample rate', () => {
      const onSpy = jest.spyOn(process, 'on');

      freshModule().initSentry(
        config({ enabled: true, dsn: 'https://example@sentry.io/1', environment: 'production' }),
      );

      expect(Sentry.init).toHaveBeenCalledWith({
        dsn: 'https://example@sentry.io/1',
        environment: 'production',
        tracesSampleRate: 0,
      });
      // Installs both process-level safety nets.
      expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

      onSpy.mockRestore();
    });
  });

  describe('captureError', () => {
    it('is a no-op before initSentry has run', () => {
      freshModule().captureError(new Error('boom'));

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('forwards to Sentry.captureException with extra context once initialized', () => {
      const mod = freshModule();
      mod.initSentry(config({ enabled: true, dsn: 'https://example@sentry.io/1' }));

      const error = new Error('boom');
      mod.captureError(error, { jobId: 'abc' });

      expect(Sentry.captureException).toHaveBeenCalledWith(error, { extra: { jobId: 'abc' } });
    });

    it('omits the extra key entirely when no context is given', () => {
      const mod = freshModule();
      mod.initSentry(config({ enabled: true, dsn: 'https://example@sentry.io/1' }));

      mod.captureError(new Error('boom'));

      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), undefined);
    });

    it('is still a no-op when init was called but disabled', () => {
      const mod = freshModule();
      mod.initSentry(config({ enabled: false }));

      mod.captureError(new Error('boom'));

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
