import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { IdempotencyService } from '../../idempotency/idempotency.service';
import { IDEMPOTENCY_EXEMPTIONS, IdempotencyInterceptor } from '../idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  const handler: CallHandler = { handle: () => of({ success: true, data: { id: 'created' } }) };

  function setup(options: {
    method: string;
    path: string;
    key?: string;
    userId?: string;
    explicit?: boolean;
  }): {
    interceptor: IdempotencyInterceptor;
    context: ExecutionContext;
    begin: jest.Mock;
    complete: jest.Mock;
  } {
    const request = {
      method: options.method,
      path: options.path,
      body: { value: 1 },
      idempotencyKey: options.key,
      user: options.userId ? { id: options.userId } : undefined,
    };
    const context = {
      getType: () => 'http',
      getHandler: () => function handlerMethod() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(options.explicit ?? false),
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const begin = jest.fn().mockResolvedValue({ kind: 'PROCEED', recordId: 'record-1' });
    const complete = jest.fn().mockResolvedValue(undefined);
    const idempotency = {
      begin,
      complete,
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdempotencyService>;

    return {
      interceptor: new IdempotencyInterceptor(reflector, idempotency),
      context,
      begin,
      complete,
    };
  }

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'protects authenticated %s routes by default',
    async (method) => {
      const { interceptor, context, begin, complete } = setup({
        method,
        path: '/api/v1/resource/1',
        key: 'operation-key-1',
        userId: 'user-1',
      });

      await firstValueFrom(await interceptor.intercept(context, handler));

      expect(begin).toHaveBeenCalledWith({
        key: 'operation-key-1',
        userId: 'user-1',
        endpoint: `${method} /api/v1/resource/1`,
        body: { value: 1 },
      });
      expect(complete).toHaveBeenCalled();
    },
  );

  it('does not apply automatically to reads', async () => {
    const { interceptor, context, begin } = setup({
      method: 'GET',
      path: '/api/v1/resource',
      key: 'operation-key-1',
      userId: 'user-1',
    });

    await firstValueFrom(await interceptor.intercept(context, handler));
    expect(begin).not.toHaveBeenCalled();
  });

  it.each(IDEMPOTENCY_EXEMPTIONS)(
    'documents and skips $method $reason',
    async ({ method, path }) => {
      const concretePath = [
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/merchants/check',
        '/api/v1/transfers/validate',
        '/api/v1/media/blob',
      ].find((candidate) => path.test(candidate));
      expect(concretePath).toBeDefined();
      const { interceptor, context, begin } = setup({
        method,
        path: concretePath!,
        key: 'operation-key-1',
        userId: 'user-1',
      });

      await firstValueFrom(await interceptor.intercept(context, handler));
      expect(begin).not.toHaveBeenCalled();
    },
  );

  it('replays the stored response without running the handler', async () => {
    const { interceptor, context, begin } = setup({
      method: 'PATCH',
      path: '/api/v1/resource/1',
      key: 'operation-key-1',
      userId: 'user-1',
    });
    begin.mockResolvedValue({
      kind: 'REPLAY',
      statusCode: 200,
      body: { success: true, data: { id: 'first' } },
    });
    const nextHandle = jest.fn(() => of({ success: true, data: { id: 'second' } }));
    const next = { handle: nextHandle };

    await expect(firstValueFrom(await interceptor.intercept(context, next))).resolves.toEqual({
      success: true,
      data: { id: 'first' },
    });
    expect(nextHandle).not.toHaveBeenCalled();
  });
});
