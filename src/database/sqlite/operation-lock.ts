import type Database from 'better-sqlite3';

const pending = new WeakMap<Database.Database, Promise<unknown>>();

// Native SQLite allows other instances sharing a handle to join an async
// transaction. Serialize library writes and revision reads on that handle.
export async function withSqliteOperationLock<Result>(
  database: Database.Database,
  operation: () => Result | Promise<Result>,
): Promise<Result> {
  const previous = pending.get(database) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  pending.set(database, next);
  try {
    return await next;
  } finally {
    if (pending.get(database) === next) {
      pending.delete(database);
    }
  }
}
