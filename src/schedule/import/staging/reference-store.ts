import type Database from 'better-sqlite3';

const MAX_CACHE_ENTRIES = 32_768;
const MAX_CACHE_BYTES = 4 * 1024 * 1024;

export function createGtfsValidationReferenceStore(
  database: Database.Database,
) {
  database.exec(`CREATE TABLE reference_values (filename TEXT, field TEXT, value TEXT,
    PRIMARY KEY (filename, field, value)) WITHOUT ROWID`);
  const insert = database.prepare(
    'INSERT OR IGNORE INTO reference_values VALUES (?, ?, ?)',
  );
  const find = database.prepare(
    'SELECT 1 FROM reference_values WHERE filename = ? AND field = ? AND value = ?',
  );
  const cache = new Map<string, boolean>();
  const queue: (string | undefined)[] = new Array(MAX_CACHE_ENTRIES);
  let head = 0;
  let cacheBytes = 0;

  function remember(key: string, found: boolean) {
    const bytes = key.length * 2 + 64;
    if (bytes > MAX_CACHE_BYTES) {
      return;
    }
    if (cache.has(key)) {
      cache.set(key, found);
      return;
    }
    while (
      cache.size >= MAX_CACHE_ENTRIES ||
      cacheBytes + bytes > MAX_CACHE_BYTES
    ) {
      const oldest = queue[head];
      if (oldest === undefined) {
        throw new Error('Missing reference cache eviction entry');
      }
      queue[head] = undefined;
      head = (head + 1) % MAX_CACHE_ENTRIES;
      cache.delete(oldest);
      cacheBytes -= oldest.length * 2 + 64;
    }
    queue[(head + cache.size) % MAX_CACHE_ENTRIES] = key;
    cache.set(key, found);
    cacheBytes += bytes;
  }

  return {
    add(filename: string, field: string, value: string) {
      const key = `${filename}\0${field}\0${value}`;
      if (cache.get(key) === true) {
        return;
      }
      insert.run(filename, field, value);
      remember(key, true);
    },
    has(filename: string, field: string, value: string) {
      const key = `${filename}\0${field}\0${value}`;
      const cached = cache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const found = find.get(filename, field, value) !== undefined;
      remember(key, found);
      return found;
    },
  };
}
