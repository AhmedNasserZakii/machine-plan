import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, from, of } from 'rxjs';
import { currentAuditContext } from '../../audit/audit-context';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditEntityType } from '../../enums/audit.enum';
import { AuditInterceptor } from '../audit.interceptor';

describe('AuditInterceptor', () => {
  function setup(options: {
    financeRead?: boolean;
    userId?: string;
    handle: () => ReturnType<CallHandler['handle']>;
  }): { interceptor: AuditInterceptor; context: ExecutionContext; record: jest.Mock } {
    const request = {
      requestId: 'req-1',
      ip: '10.0.0.1',
      headers: { 'user-agent': 'jest-agent' },
      user: options.userId ? { id: options.userId } : undefined,
    };
    const context = {
      getType: () => 'http',
      getHandler: () => function handlerMethod() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(options.financeRead ?? false),
    } as unknown as Reflector;
    const record = jest.fn().mockResolvedValue(undefined);
    const audit = { record } as unknown as AuditService;

    return { interceptor: new AuditInterceptor(reflector, audit), context, record };
  }

  it('propagates the ambient context into an async handler even though Nest subscribes lazily', async () => {
    let seenDuringHandler: unknown;

    // `next.handle()` mimics how Nest actually returns a lazy, promise-backed Observable for an
    // async controller method: nothing runs until something subscribes, and by then this
    // function's own synchronous stack has long since returned to its caller. If the interceptor
    // only wrapped `next.handle()` without controlling when it is subscribed, this would read
    // `undefined` instead of the context set up below.
    const handle = jest.fn(() =>
      from(
        (async () => {
          await Promise.resolve();
          seenDuringHandler = currentAuditContext();
          return { success: true, data: {} };
        })(),
      ),
    );
    const { interceptor, context } = setup({ handle });

    await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(seenDuringHandler).toEqual({
      requestId: 'req-1',
      ipAddress: '10.0.0.1',
      userAgent: 'jest-agent',
    });
  });

  it('does not record a finance-read event for a route without the decorator', async () => {
    const handle = jest.fn(() => of({ success: true, data: {} }));
    const { interceptor, context, record } = setup({
      financeRead: false,
      userId: 'user-1',
      handle,
    });

    await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(record).not.toHaveBeenCalled();
  });

  it('records one no-payload event for an authenticated hit on a finance-read route', async () => {
    const handle = jest.fn(() => of({ success: true, data: { balance: 1000 } }));
    const { interceptor, context, record } = setup({ financeRead: true, userId: 'user-1', handle });

    const result = await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(result).toEqual({ success: true, data: { balance: 1000 } });
    expect(record).toHaveBeenCalledWith({
      userId: 'user-1',
      action: AuditAction.FINANCE_READ_ACCESSED,
      entityType: AuditEntityType.FINANCE,
    });
  });

  it('does not record a finance-read event for an unauthenticated request', async () => {
    const handle = jest.fn(() => of({ success: true, data: {} }));
    const { interceptor, context, record } = setup({ financeRead: true, handle });

    await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(record).not.toHaveBeenCalled();
  });
});
