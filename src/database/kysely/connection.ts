import type { Kysely } from 'kysely';
import {
  createDatabaseCleanupError,
  createDatabaseRecoveryError,
} from '../cleanup.ts';

/** Keep callback failures when Kysely's connection release also rejects. */
export async function withKyselyConnection<DB, Result>(
  database: Kysely<DB>,
  operation: (connection: Kysely<DB>) => Promise<Result>,
): Promise<Result> {
  if (database.isTransaction) {
    return operation(database);
  }
  let failure: { error: unknown } | undefined;
  let completed = false;
  try {
    return await database.connection().execute(async (connection) => {
      try {
        const result = await operation(connection);
        completed = true;
        return result;
      } catch (error) {
        failure = { error };
        throw error;
      }
    });
  } catch (error) {
    if (failure !== undefined && !Object.is(error, failure.error)) {
      throw createDatabaseCleanupError(failure.error, error);
    }
    if (completed) {
      throw createDatabaseRecoveryError(
        error,
        'Could not release database connection',
      );
    }
    throw error;
  }
}
