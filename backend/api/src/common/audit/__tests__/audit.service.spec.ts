import { Repository } from 'typeorm';
import { runWithAuditContext } from '../audit-context';
import { AuditLog } from '../audit-log.entity';
import { AuditQueueService } from '../audit-queue.service';
import { AuditService } from '../audit.service';
import { AuditAction, AuditEntityType } from '../../enums/audit.enum';
import { REDACTED_PLACEHOLDER } from '../redaction';

describe('AuditService', () => {
  function service(): {
    subject: AuditService;
    enqueue: jest.Mock;
    insert: jest.Mock;
  } {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const queue = { enqueue, start: jest.fn() } as unknown as AuditQueueService;
    const insert = jest.fn().mockResolvedValue(undefined);
    const repo = { insert } as unknown as Repository<AuditLog>;

    return { subject: new AuditService(repo, queue), enqueue, insert };
  }

  it('diffs before/after down to changed keys before enqueuing', async () => {
    const { subject, enqueue } = service();

    await subject.record({
      userId: 'user-1',
      action: AuditAction.MAINTENANCE_CLOSED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: 'order-1',
      before: { status: 'RETURNED', cost: 0 },
      after: { status: 'CLOSED', cost: 450 },
    });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const row = enqueue.mock.calls[0][0];
    expect(row).toMatchObject({
      userId: 'user-1',
      action: AuditAction.MAINTENANCE_CLOSED,
      entityType: AuditEntityType.MAINTENANCE_ORDER,
      entityId: 'order-1',
      before: { status: 'RETURNED', cost: 0 },
      after: { status: 'CLOSED', cost: 450 },
    });
    expect(row.id).toEqual(expect.any(String));
    expect(row.createdAt).toEqual(expect.any(String));
  });

  it('redacts sensitive fields before they ever reach the queue', async () => {
    const { subject, enqueue } = service();

    await subject.record({
      userId: 'user-1',
      action: AuditAction.USER_UPDATED,
      before: { passwordHash: 'old' },
      after: { passwordHash: 'new' },
    });

    const row = enqueue.mock.calls[0][0];
    expect(row.before).toEqual({ passwordHash: REDACTED_PLACEHOLDER });
    expect(row.after).toEqual({ passwordHash: REDACTED_PLACEHOLDER });
  });

  it('records a null actor for an unauthenticated event', async () => {
    const { subject, enqueue } = service();

    await subject.record({ userId: null, action: AuditAction.LOGIN_FAILED });

    expect(enqueue.mock.calls[0][0]).toMatchObject({ userId: null, before: null, after: null });
  });

  it('fills request context from the ambient store when the caller does not pass it', async () => {
    const { subject, enqueue } = service();

    await runWithAuditContext(
      { requestId: 'req-1', ipAddress: '10.0.0.1', userAgent: 'jest' },
      () => subject.record({ userId: 'user-1', action: AuditAction.LOGIN_SUCCESS }),
    );

    expect(enqueue.mock.calls[0][0]).toMatchObject({
      requestId: 'req-1',
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });
  });

  it('prefers an explicitly passed context field over the ambient one', async () => {
    const { subject, enqueue } = service();

    await runWithAuditContext({ requestId: 'ambient', ipAddress: null, userAgent: null }, () =>
      subject.record({
        userId: 'user-1',
        action: AuditAction.LOGIN_SUCCESS,
        requestId: 'explicit',
      }),
    );

    expect(enqueue.mock.calls[0][0]).toMatchObject({ requestId: 'explicit' });
  });

  it('never throws when the queue rejects', async () => {
    const { subject, enqueue } = service();
    enqueue.mockRejectedValue(new Error('redis is down'));

    await expect(
      subject.record({ userId: 'user-1', action: AuditAction.LOGIN_SUCCESS }),
    ).resolves.toBeUndefined();
  });
});
