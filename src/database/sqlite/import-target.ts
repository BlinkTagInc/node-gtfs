import type Database from 'better-sqlite3';
import type { ScheduleImportTarget } from '../import-target.ts';
import type { GtfsStoragePlan } from '../storage/plan.ts';
import { beginUnsafeBulkSqlite, type SqliteDurability } from './durability.ts';
import {
  applySqliteGtfsTablePlan,
  applySqliteGtfsIndexPlan,
} from './schema-writer.ts';
import { createSqliteGtfsWriter } from './schedule-writer.ts';
import {
  findSqliteSourceDataTables,
  deleteSqliteSourceData,
} from './source-data.ts';
import { runSqliteTransaction } from './transaction.ts';
import {
  lockSqliteSource,
  invalidateSqliteSourceRealtime,
} from './source-state.ts';
import { withSqliteOperationLock } from './operation-lock.ts';
import { DEFAULT_GTFS_DATABASE_CONFIG } from '../../config/defaults.ts';
import { refreshSqliteTripStatistics } from './trip-statistics.ts';

export function createSqliteImportTarget(options: {
  readonly database: Database.Database;
  readonly storagePlan: GtfsStoragePlan;
  readonly databasePath?: string;
  readonly durability?: SqliteDurability;
}): ScheduleImportTarget {
  const {
    database,
    storagePlan,
    databasePath = DEFAULT_GTFS_DATABASE_CONFIG.path,
  } = options;
  const restoreDurability =
    options.durability === 'unsafe-bulk'
      ? beginUnsafeBulkSqlite(database)
      : undefined;

  const target: ScheduleImportTarget = {
    schemaDatabase: { database, dialect: 'sqlite' },
    databaseDescription: `SQLite database at ${databasePath}`,
    errorDetails: { path: databasePath },
    storagePlan,
    initialize() {
      return applySqliteGtfsTablePlan(database, storagePlan);
    },
    createWriter(options) {
      return createSqliteGtfsWriter({
        database,
        databasePath,
        ...options,
        storagePlan,
      });
    },
    lockSource(sourceId) {
      lockSqliteSource(database, sourceId);
    },
    invalidateRealtime(sourceId) {
      return invalidateSqliteSourceRealtime(database, sourceId);
    },
    findSourceDataTables(options) {
      return findSqliteSourceDataTables({ database, ...options });
    },
    deleteSourceData(options) {
      return deleteSqliteSourceData({ database, ...options });
    },
    runSourceTransaction(operation) {
      return withSqliteOperationLock(database, () => {
        // Nested work belongs to this transaction; other targets must still
        // wait for the handle's operation lock instead of joining it.
        const transactionTarget: ScheduleImportTarget = {
          ...target,
          runSourceTransaction(nestedOperation) {
            return runSqliteTransaction(database, () =>
              nestedOperation(transactionTarget),
            );
          },
        };
        return runSqliteTransaction(database, () =>
          operation(transactionTarget),
        );
      });
    },
    finalize(onCreateIndexes) {
      return applySqliteGtfsIndexPlan(database, storagePlan, onCreateIndexes);
    },
    refreshStatistics() {
      return withSqliteOperationLock(database, () => {
        if (
          storagePlan.tables.some(({ table }) => table.tableName === 'trips')
        ) {
          refreshSqliteTripStatistics(database);
        }
      });
    },
    ...(restoreDurability === undefined ? {} : { restoreDurability }),
  };
  return target;
}
