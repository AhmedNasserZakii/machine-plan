import { Repository } from 'typeorm';
import { ErrorCode } from '../../constants/error-codes';
import { sha256Object } from '../../utils';
import { IdempotencyKeyRecord, IdempotencyStatus } from '../idempotency-key.entity';
import { IdempotencyService } from '../idempotency.service';

type QueryBuilderMock = Record<string, jest.Mock>;

function queryBuilder(result: unknown): QueryBuilderMock {
  const builder: QueryBuilderMock = {};
  for (const method of [
    'insert',
    'into',
    'values',
    'orIgnore',
    'returning',
    'update',
    'set',
    'where',
    'andWhere',
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.execute = jest.fn().mockResolvedValue(result);
  return builder;
}

describe('IdempotencyService', () => {
  const request = {
    key: 'operation-key-1',
    userId: 'user-1',
    endpoint: 'POST /api/v1/resource',
    body: { value: 1 },
  };
  const requestHash = sha256Object(request.body);

  function setup(
    existing: Partial<IdempotencyKeyRecord> | null,
    builders: QueryBuilderMock[],
  ): {
    subject: IdempotencyService;
    repository: jest.Mocked<Repository<IdempotencyKeyRecord>>;
  } {
    const repository = {
      createQueryBuilder: jest.fn(() => builders.shift()),
      findOne: jest.fn().mockResolvedValue(existing),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<IdempotencyKeyRecord>>;

    return { subject: new IdempotencyService(repository), repository };
  }

  it('replays the completed response for the same endpoint and payload', async () => {
    const stored = { success: true, data: { id: 'first' } };
    const { subject } = setup(
      {
        id: 'record-1',
        endpoint: request.endpoint,
        requestHash,
        status: IdempotencyStatus.COMPLETED,
        statusCode: 201,
        responseBody: stored,
        expiresAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      },
      [queryBuilder({ raw: [] })],
    );

    await expect(subject.begin(request)).resolves.toEqual({
      kind: 'REPLAY',
      statusCode: 201,
      body: stored,
    });
  });

  it('rejects reuse of a live key with a different payload', async () => {
    const { subject } = setup(
      {
        id: 'record-1',
        endpoint: request.endpoint,
        requestHash: 'different-hash',
        status: IdempotencyStatus.COMPLETED,
        expiresAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      },
      [queryBuilder({ raw: [] })],
    );

    await expect(subject.begin(request)).rejects.toMatchObject({
      code: ErrorCode.IDEMPOTENCY_KEY_REUSED,
    });
  });

  it('rejects a concurrent attempt while the first request is in progress', async () => {
    const { subject } = setup(
      {
        id: 'record-1',
        endpoint: request.endpoint,
        requestHash,
        status: IdempotencyStatus.IN_PROGRESS,
        expiresAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      },
      [queryBuilder({ raw: [] })],
    );

    await expect(subject.begin(request)).rejects.toMatchObject({
      code: ErrorCode.IDEMPOTENT_REQUEST_IN_PROGRESS,
    });
  });

  it('reclaims an expired key', async () => {
    const { subject } = setup(
      {
        id: 'record-1',
        endpoint: 'PATCH /old',
        requestHash: 'old-hash',
        status: IdempotencyStatus.COMPLETED,
        expiresAt: new Date(Date.now() - 60_000),
        updatedAt: new Date(Date.now() - 60_000),
      },
      [queryBuilder({ raw: [] }), queryBuilder({ affected: 1 })],
    );

    await expect(subject.begin(request)).resolves.toEqual({
      kind: 'PROCEED',
      recordId: 'record-1',
    });
  });
});
