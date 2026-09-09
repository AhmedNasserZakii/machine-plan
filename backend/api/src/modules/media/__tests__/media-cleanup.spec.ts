import { ConfigService } from '@nestjs/config';
import { FindOperator, Repository } from 'typeorm';
import { Media } from '../entities/media.entity';
import { MediaOptimizeService } from '../media-optimize.service';
import { MediaService } from '../media.service';
import { StorageService } from '../storage/storage.service';

function media(overrides: Partial<Media> = {}): Media {
  const id = overrides.id ?? 'm1';
  return {
    id,
    storageKey: `transfer-photos/2026/09/${id}.jpg`,
    isConfirmed: false,
    ...overrides,
  } as Media;
}

describe('MediaService.purgeOrphans', () => {
  function service(rows: Media[]): {
    subject: MediaService;
    find: jest.Mock;
    softDelete: jest.Mock;
    storageDelete: jest.Mock;
  } {
    const find = jest.fn().mockResolvedValue(rows);
    const softDelete = jest.fn().mockResolvedValue(undefined);
    const repo = { find, softDelete } as unknown as Repository<Media>;

    const storageDelete = jest.fn().mockResolvedValue(undefined);
    const storage = { delete: storageDelete } as unknown as StorageService;

    const optimizer = {} as MediaOptimizeService;
    const config = {
      getOrThrow: () => ({ cleanupEnabled: false }),
    } as unknown as ConfigService;

    return {
      subject: new MediaService(repo, storage, optimizer, config),
      find,
      softDelete,
      storageDelete,
    };
  }

  it('deletes the storage object and soft-deletes the row for every orphan found', async () => {
    const rows = [media({ id: 'a' }), media({ id: 'b' })];
    const { subject, softDelete, storageDelete } = service(rows);

    const result = await subject.purgeOrphans();

    expect(result).toEqual({ removed: 2, failed: 0 });
    expect(storageDelete).toHaveBeenCalledTimes(2);
    expect(softDelete).toHaveBeenCalledWith(['a', 'b']);
  });

  it('queries only unconfirmed rows past the 24h cutoff', async () => {
    const { subject, find } = service([]);
    const now = new Date('2026-09-08T12:00:00.000Z');

    await subject.purgeOrphans(now);

    const call = find.mock.calls[0][0] as {
      where: { isConfirmed: boolean; createdAt: FindOperator<Date> };
    };
    expect(call.where.isConfirmed).toBe(false);
    expect(call.where.createdAt.type).toBe('lessThan');
    expect(call.where.createdAt.value).toEqual(new Date('2026-09-07T12:00:00.000Z'));
  });

  it('does nothing and soft-deletes nothing when there are no orphans', async () => {
    const { subject, softDelete } = service([]);

    expect(await subject.purgeOrphans()).toEqual({ removed: 0, failed: 0 });
    expect(softDelete).not.toHaveBeenCalled();
  });

  it('keeps processing the rest of the batch when one storage delete fails, and only soft-deletes the ones that succeeded', async () => {
    const rows = [media({ id: 'a' }), media({ id: 'b' }), media({ id: 'c' })];
    const { subject, softDelete, storageDelete } = service(rows);
    storageDelete.mockImplementation((key: string) =>
      key.includes('b') ? Promise.reject(new Error('storage unreachable')) : Promise.resolve(),
    );

    const result = await subject.purgeOrphans();

    expect(result).toEqual({ removed: 2, failed: 1 });
    expect(softDelete).toHaveBeenCalledWith(['a', 'c']);
  });

  it('soft-deletes nothing when every storage delete in the batch fails', async () => {
    const rows = [media({ id: 'a' })];
    const { subject, softDelete, storageDelete } = service(rows);
    storageDelete.mockRejectedValue(new Error('storage unreachable'));

    const result = await subject.purgeOrphans();

    expect(result).toEqual({ removed: 0, failed: 1 });
    expect(softDelete).not.toHaveBeenCalled();
  });
});

describe('MediaService cleanup scheduling', () => {
  function service(cleanupEnabled: boolean): MediaService {
    const repo = {} as Repository<Media>;
    const storage = {} as StorageService;
    const optimizer = {} as MediaOptimizeService;
    const config = { getOrThrow: () => ({ cleanupEnabled }) } as unknown as ConfigService;

    return new MediaService(repo, storage, optimizer, config);
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts no timer when the sweep is disabled', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(global, 'setInterval');
    const subject = service(false);

    subject.onModuleInit();

    expect(spy).not.toHaveBeenCalled();
    subject.onModuleDestroy();
  });

  it('starts an unref-ed timer when the sweep is enabled, and clears it on destroy', () => {
    jest.useFakeTimers();
    const subject = service(true);

    subject.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);

    subject.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
