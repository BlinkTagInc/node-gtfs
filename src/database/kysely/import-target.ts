import type { Kysely } from 'kysely';
import type { ScheduleImportTarget } from '../import-target.ts';
import type { GtfsStoragePlan } from '../storage/plan.ts';
import {
  applyKyselyGtfsTablePlan,
  applyKyselyGtfsIndexPlan,
} from './schema-writer.ts';
import { createKyselyGtfsWriter } from './schedule-writer.ts';
import {
  findKyselySourceDataTables,
  deleteKyselySourceData,
} from './source-data.ts';
import {
  lockKyselySource,
  invalidateKyselySourceRealtime,
} from './source-state.ts';
import { refreshKyselySqliteTripStatistics } from './trip-statistics.ts';
import { runKyselyTransaction } from './transaction.ts';

export function createKyselyImportTarget<DB>(options: {
  readonly database: Kysely<DB>;
  readonly storagePlan: GtfsStoragePlan;
}): ScheduleImportTarget {
  const { database } = options;
  // MySQL DDL commits the caller's transaction, including CREATE IF NOT EXISTS.
  const storagePlan =
    database.isTransaction && options.storagePlan.dialect === 'mysql'
      ? { ...options.storagePlan, mode: 'validate' as const }
      : options.storagePlan;
  const target: ScheduleImportTarget = {
    schemaDatabase: { database, dialect: storagePlan.dialect },
    databaseDescription: `Kysely ${storagePlan.dialect} database`,
    errorDetails: { databaseDialect: storagePlan.dialect },
    storagePlan,
    initialize() {
      return applyKyselyGtfsTablePlan(database, storagePlan);
    },
    createWriter(options) {
      return createKyselyGtfsWriter({
        database,
        ...options,
        storagePlan,
      });
    },
    async lockSource(sourceId) {
      await lockKyselySource(database, sourceId, storagePlan);
    },
    invalidateRealtime(sourceId) {
      return invalidateKyselySourceRealtime(database, sourceId, storagePlan);
    },
    findSourceDataTables(sourceDataOptions) {
      return findKyselySourceDataTables({ database, ...sourceDataOptions });
    },
    deleteSourceData(sourceDataOptions) {
      return deleteKyselySourceData({ database, ...sourceDataOptions });
    },
    runSourceTransaction(operation) {
      return runKyselyTransaction(database, (transaction) =>
        operation(
          transaction === database
            ? target
            : createKyselyImportTarget({ database: transaction, storagePlan }),
        ),
      );
    },
    finalize(onCreateIndexes) {
      return applyKyselyGtfsIndexPlan(database, storagePlan, onCreateIndexes);
    },
    async refreshStatistics() {
      if (
        storagePlan.dialect === 'sqlite' &&
        storagePlan.tables.some(({ table }) => table.tableName === 'trips')
      ) {
        await refreshKyselySqliteTripStatistics(database);
      }
    },
  };
  return target;
}
