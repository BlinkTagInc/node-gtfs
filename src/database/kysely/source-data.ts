import { cancellationCheckpoint } from '../../cancellation.ts';
import type { Kysely } from 'kysely';

import { asDynamicKysely } from '../clients.ts';

interface KyselySourceDataOptions<DB> {
  readonly database: Kysely<DB>;
  readonly sourceId: string;
  readonly tableNames: readonly string[];
}

export async function findKyselySourceDataTables<DB>(
  options: KyselySourceDataOptions<DB>,
): Promise<readonly string[]> {
  const database = asDynamicKysely(options.database);
  const existingTableNames: string[] = [];
  for (const tableName of options.tableNames) {
    await cancellationCheckpoint();
    const row = await database
      .selectFrom(tableName)
      .select('source_id')
      .where('source_id', '=', options.sourceId)
      .limit(1)
      .executeTakeFirst();
    if (row !== undefined) {
      existingTableNames.push(tableName);
    }
  }
  return existingTableNames;
}

export async function deleteKyselySourceData<DB>(
  options: KyselySourceDataOptions<DB>,
): Promise<void> {
  const database = asDynamicKysely(options.database);
  for (const tableName of options.tableNames) {
    await cancellationCheckpoint();
    await database
      .deleteFrom(tableName)
      .where('source_id', '=', options.sourceId)
      .execute();
  }
}
