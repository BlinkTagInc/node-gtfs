import type Database from 'better-sqlite3';
import { createDatabaseCleanupError } from '../cleanup.ts';

let savepointOrdinal = 0;

/**
 * Runs asynchronous work in a SQLite transaction without committing when the
 * callback first returns a Promise, as `better-sqlite3`'s transaction helper
 * would do.
 */
export async function runSqliteTransaction<Result>(
  database: Database.Database,
  operation: () => Promise<Result>,
): Promise<Result> {
  const ownsTransaction = !database.inTransaction;
  const savepointName = `node_gtfs_async_${savepointOrdinal++}`;
  database.exec(ownsTransaction ? 'BEGIN' : `SAVEPOINT ${savepointName}`);

  try {
    const result = await operation();
    database.exec(
      ownsTransaction ? 'COMMIT' : `RELEASE SAVEPOINT ${savepointName}`,
    );
    return result;
  } catch (error: unknown) {
    try {
      if (database.inTransaction) {
        database.exec(
          ownsTransaction
            ? 'ROLLBACK'
            : `ROLLBACK TO SAVEPOINT ${savepointName}; RELEASE SAVEPOINT ${savepointName}`,
        );
      }
    } catch (cleanupError) {
      throw createDatabaseCleanupError(error, cleanupError);
    }
    throw error;
  }
}
