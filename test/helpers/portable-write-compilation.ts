import type { Kysely } from 'kysely';
import { fileBackedTables } from '../../src/schema/table-registry.ts';
import { createGtfsStoragePlan } from '../../src/database/storage/plan.ts';
import {
  applyKyselyGtfsTablePlan,
  applyKyselyGtfsIndexPlan,
} from '../../src/database/kysely/schema-writer.ts';
import { createKyselyGtfsWriter } from '../../src/database/kysely/schedule-writer.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';

// Dummy drivers can capture SQL, but cannot validate a database schema.
// Exercise the schema and row writers directly, below import preflight.
export async function compilePortableWrites<DB>(options: {
  database: Kysely<DB>;
  dialect: 'postgres' | 'mysql';
  directory: string;
  onDuplicateKey?: 'reject' | 'keep-first';
}): Promise<void> {
  const { database, dialect, directory, onDuplicateKey = 'reject' } = options;
  const storagePlan = createGtfsStoragePlan({ dialect, mode: 'recreate' });
  await applyKyselyGtfsTablePlan(database, storagePlan);
  const tables = fileBackedTables.filter(
    (table) => table.specification === 'gtfs-schedule',
  );
  const staged = await stageGtfsSource({
    directory,
    tables,
    sourceId: 'test',
    mode: 'off',
    onUnknownField: 'discard',
    onDuplicateKey,
  });
  try {
    staged.assertNormalized();
    for (const table of tables) {
      const file = staged.files.get(table.filename);
      if (file === undefined) {
        continue;
      }
      const writer = createKyselyGtfsWriter({
        database,
        storagePlan,
        table,
        filename: table.filename,
        sourceId: 'test',
        onDuplicateKey,
        reporting: { level: 'silent' },
      });
      for (const batch of staged.batches(table, 100, file.totalRecordCount)) {
        await writer.writeBatch(batch);
      }
    }
    await applyKyselyGtfsIndexPlan(database, storagePlan);
  } finally {
    await staged.close();
  }
}
