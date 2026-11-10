import type Database from 'better-sqlite3';
import { withSyncDatabaseCleanup } from '../cleanup.ts';

/** Refresh only trips: approximate source cardinality can favor a full-source scan. */
export function refreshSqliteTripStatistics(database: Database.Database): void {
  const analysisLimit = database.pragma('analysis_limit', {
    simple: true,
  }) as number;
  withSyncDatabaseCleanup(
    () => {
      database.pragma('analysis_limit = 0');
      database.exec('ANALYZE "trips"');
    },
    () => {
      database.pragma(`analysis_limit = ${analysisLimit}`);
    },
  );
}
