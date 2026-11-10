import type { Kysely } from 'kysely';

import {
  reportStoredDuplicateKeys,
  toGtfsWriteError,
  type GtfsFileWriter,
  type GtfsScheduleWriterOptions,
} from '../../schedule/import/writer.ts';
import { getGtfsDialectCapabilities } from '../dialects.ts';
import { getGtfsTableStoragePlan } from '../storage/plan.ts';
import { createGtfsStorageRowProjector } from '../storage/row-projection.ts';
import { asDynamicKysely } from '../clients.ts';
import { insertMysqlRowsKeepingFirst } from './insert-keeping-first.ts';

export function createKyselyGtfsWriter<DB>(
  options: GtfsScheduleWriterOptions<Kysely<DB>>,
): GtfsFileWriter {
  const { storagePlan } = options;
  const database = asDynamicKysely(options.database);
  const capabilities = getGtfsDialectCapabilities(storagePlan.dialect);
  const tablePlan = getGtfsTableStoragePlan(
    storagePlan,
    options.table.tableName,
  );
  const projectRow = createGtfsStorageRowProjector(tablePlan);
  const chunkSize = Math.max(
    1,
    Math.min(
      capabilities.maximumRowsPerInsert,
      Math.floor(
        capabilities.maximumParametersPerInsert / tablePlan.columns.length,
      ),
    ),
  );

  return {
    async writeBatch(batch) {
      if (batch.table.tableName !== options.table.tableName) {
        throw new Error(
          `Writer for ${options.table.tableName} received a batch for ${batch.table.tableName}`,
        );
      }
      const records = batch.records;
      if (records.length === 0) {
        return { rowsInserted: 0, rowsSkipped: 0 };
      }

      let skippedStoredRows = 0;
      for (let offset = 0; offset < records.length; offset += chunkSize) {
        const chunk = records.slice(offset, offset + chunkSize);
        try {
          const values = chunk.map(({ row }) => projectRow(row));

          if (
            options.onDuplicateKey === 'keep-first' &&
            storagePlan.dialect === 'mysql'
          ) {
            skippedStoredRows += await insertMysqlRowsKeepingFirst({
              rows: values,
              insert: async (rows) => {
                await database
                  .insertInto(options.table.tableName)
                  .values(rows)
                  .executeTakeFirst();
              },
            });
            continue;
          }

          let insert = database
            .insertInto(options.table.tableName)
            .values(values);

          if (options.onDuplicateKey === 'keep-first') {
            insert = insert.onConflict((conflict) => conflict.doNothing());
          }

          const result = await insert.executeTakeFirst();
          const affectedRows = result.numInsertedOrUpdatedRows;
          if (
            affectedRows === undefined ||
            affectedRows < 0n ||
            affectedRows > BigInt(values.length)
          ) {
            throw new Error(
              'Database did not report a valid inserted row count',
            );
          }
          skippedStoredRows += values.length - Number(affectedRows);
        } catch (error) {
          throw toGtfsWriteError(error, options, {
            positions: chunk.map(({ position }) => position),
            databaseDialect: storagePlan.dialect,
          });
        }
      }
      reportStoredDuplicateKeys(options, skippedStoredRows);
      return {
        rowsInserted: records.length - skippedStoredRows,
        rowsSkipped: skippedStoredRows,
      };
    },
  };
}
