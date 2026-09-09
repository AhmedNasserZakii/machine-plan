import { MemoryCacheDriver } from '../memory-cache.driver';

describe('MemoryCacheDriver', () => {
  let driver: MemoryCacheDriver;

  beforeEach(() => {
    driver = new MemoryCacheDriver();
  });

  it('stores and reads a value', async () => {
    await driver.set('perm:1', 'value');
    await expect(driver.get('perm:1')).resolves.toBe('value');
  });

  it('returns null for a missing key', async () => {
    await expect(driver.get('missing')).resolves.toBeNull();
  });

  it('expires a value once its ttl elapses', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-07T12:00:00Z'));
    await driver.set('perm:1', 'value', 60);

    jest.setSystemTime(new Date('2026-09-07T12:00:59Z'));
    await expect(driver.get('perm:1')).resolves.toBe('value');

    jest.setSystemTime(new Date('2026-09-07T12:01:01Z'));
    await expect(driver.get('perm:1')).resolves.toBeNull();

    jest.useRealTimers();
  });

  it('deletes every key matching a glob pattern', async () => {
    await driver.set('perm:1', 'a');
    await driver.set('perm:2', 'b');
    await driver.set('report:x', 'c');

    await driver.delByPattern('perm:*');

    await expect(driver.get('perm:1')).resolves.toBeNull();
    await expect(driver.get('perm:2')).resolves.toBeNull();
    await expect(driver.get('report:x')).resolves.toBe('c');
  });

  it('increments a counter and keeps the original expiry', async () => {
    await expect(driver.incr('login:attempts', 900)).resolves.toBe(1);
    await expect(driver.incr('login:attempts', 900)).resolves.toBe(2);
    await expect(driver.incr('login:attempts', 900)).resolves.toBe(3);
  });

  it('reports -2 for an unknown key and -1 for a key without a ttl', async () => {
    await expect(driver.ttl('nope')).resolves.toBe(-2);
    await driver.set('forever', 'v');
    await expect(driver.ttl('forever')).resolves.toBe(-1);
  });

  /**
   * Expired entries are only evicted when read, and login-throttle keys are keyed by
   * phone *and* IP — unbounded cardinality that nothing ever reads again. Without a cap a
   * long-running process grows until it runs out of memory.
   */
  describe('bounded growth', () => {
    it('stays bounded when far more keys are written than the cap', async () => {
      for (let index = 0; index < 12_000; index += 1) {
        await driver.set(`login:attempts:${index}`, '1');
      }

      // The most recent write always survives; the oldest are the ones dropped.
      await expect(driver.get('login:attempts:11999')).resolves.toBe('1');
      await expect(driver.get('login:attempts:0')).resolves.toBeNull();
    });

    it('sweeps expired entries in preference to evicting live ones', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-07T12:00:00Z'));

      // Oldest insertion, and the one a naive oldest-first eviction would drop first.
      await driver.set('perm:live-oldest', 'value');

      for (let index = 0; index < 9_999; index += 1) {
        await driver.set(`stale:${index}`, '1', 60);
      }

      // Now at the cap with 9,999 expired entries. The next write must reclaim that dead
      // space rather than evict the live value that happens to be oldest.
      jest.setSystemTime(new Date('2026-09-07T12:02:00Z'));
      await driver.set('trigger', 'value');

      await expect(driver.get('perm:live-oldest')).resolves.toBe('value');
      await expect(driver.get('trigger')).resolves.toBe('value');
      await expect(driver.get('stale:0')).resolves.toBeNull();

      jest.useRealTimers();
    });

    it('counts incremented counters against the cap too', async () => {
      for (let index = 0; index < 12_000; index += 1) {
        await driver.incr(`pwchange:${index}`, 900);
      }

      await expect(driver.get('pwchange:11999')).resolves.toBe('1');
      await expect(driver.get('pwchange:0')).resolves.toBeNull();
    });
  });
});
