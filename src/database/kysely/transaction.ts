import { sql, type Kysely } from 'kysely';
import { throwIfOperationAborted } from '../../cancellation.ts';
import {
  createDatabaseCleanupError,
  createDatabaseRecoveryError,
} from '../cleanup.ts';
import { withKyselyConnection } from './connection.ts';

export async function runKyselyTransaction<DB, Result>(
  database: Kysely<DB>,
  operation: (transaction: Kysely<DB>) => Promise<Result>,
): Promise<Result> {
  if (database.isTransaction) {
    return withKyselySavepoint(database, () => operation(database));
  }

  // The outer reservation releases the real connection even when controlled
  // BEGIN/COMMIT/ROLLBACK fails before Kysely releases its inner reservation.
  return withKyselyConnection(database, async (connection) => {
    const transaction = await connection
      .startTransaction()
      .execute()
      .catch((error: unknown) => {
        throw createDatabaseRecoveryError(
          error,
          'Could not confirm database transaction start',
        );
      });
    let committing = false;
    try {
      const result = await operation(transaction);
      committing = true;
      await transaction.commit().execute();
      return result;
    } catch (error) {
      try {
        await transaction.rollback().execute();
      } catch (cleanupError) {
        throw createDatabaseCleanupError(error, cleanupError);
      }
      if (committing) {
        throw createDatabaseRecoveryError(
          error,
          'Could not confirm database commit; check the stored data before retrying',
        );
      }
      throw error;
    }
  });
}

let ordinal = 0;

/** Roll back a source or snapshot without ending a caller-owned transaction. */
async function withKyselySavepoint<DB, Result>(
  database: Kysely<DB>,
  operation: () => Promise<Result>,
): Promise<Result> {
  throwIfOperationAborted();
  const name = `node_gtfs_write_${ordinal++}`;
  try {
    await sql`savepoint ${sql.id(name)}`.execute(database);
  } catch (error) {
    throw createDatabaseRecoveryError(
      error,
      'Could not create database savepoint',
    );
  }
  try {
    const result = await operation();
    throwIfOperationAborted();
    await sql`release savepoint ${sql.id(name)}`.execute(database);
    return result;
  } catch (error) {
    try {
      await sql`rollback to savepoint ${sql.id(name)}`.execute(database);
      await sql`release savepoint ${sql.id(name)}`.execute(database);
    } catch (cleanupError) {
      throw createDatabaseCleanupError(error, cleanupError);
    }
    throw error;
  }
}
