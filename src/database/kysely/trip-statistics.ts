import { sql, type Kysely } from 'kysely';
import { withDatabaseCleanup } from '../cleanup.ts';
import { withKyselyConnection } from './connection.ts';

/** Keep SQLite connection settings scoped to the connection doing the analysis. */
export async function refreshKyselySqliteTripStatistics<DB>(
  database: Kysely<DB>,
): Promise<void> {
  const refresh = async (connection: Kysely<DB>) => {
    const { rows } = await sql<{
      analysis_limit: number;
    }>`PRAGMA analysis_limit`.execute(connection);
    const analysisLimit = rows[0]?.analysis_limit;
    if (analysisLimit === undefined) {
      throw new Error('SQLite did not return an analysis limit');
    }
    await withDatabaseCleanup(
      async () => {
        await sql`PRAGMA analysis_limit = 0`.execute(connection);
        await sql`ANALYZE "trips"`.execute(connection);
      },
      async () => {
        await sql`PRAGMA analysis_limit = ${sql.lit(analysisLimit)}`.execute(
          connection,
        );
      },
    );
  };
  await withKyselyConnection(database, refresh);
}
