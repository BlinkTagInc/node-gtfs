import { throwIfOperationAborted } from '../../cancellation.ts';
import type Database from 'better-sqlite3';
import { setImmediate } from 'node:timers/promises';

import { quoteSqliteIdentifier } from './identifier.ts';
import { runSqliteTransaction } from './transaction.ts';

const DELETE_BATCH_SIZE = 1000;

interface SqliteTableColumn {
  readonly name: string;
  readonly pk: number;
}

function getDeletionKeyColumns(
  database: Database.Database,
  tableName: string,
): readonly string[] {
  const columns = database
    .prepare(`PRAGMA table_xinfo(${quoteSqliteIdentifier(tableName)})`)
    .all() as SqliteTableColumn[];
  const table = database
    .prepare(
      "SELECT wr FROM pragma_table_list WHERE name = ? AND schema IN ('main', 'temp') ORDER BY schema = 'temp' DESC LIMIT 1",
    )
    .get(tableName) as { wr: number } | undefined;
  if (table?.wr === 1) {
    return columns
      .filter((column) => column.pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map((column) => column.name);
  }
  // Applications may declare a column named rowid, shadowing that alias.
  const rowid = ['rowid', '_rowid_', 'oid'].find(
    (name) => !columns.some((column) => column.name.toLowerCase() === name),
  );
  return rowid === undefined ? [] : [rowid];
}

interface SqliteSourceDataOptions {
  readonly database: Database.Database;
  readonly sourceId: string;
  readonly tableNames: readonly string[];
}

export function findSqliteSourceDataTables(
  options: SqliteSourceDataOptions,
): readonly string[] {
  return options.tableNames.filter((tableName) => {
    const row = options.database
      .prepare(
        `SELECT 1 FROM ${quoteSqliteIdentifier(tableName)} WHERE ${quoteSqliteIdentifier('source_id')} = ? LIMIT 1`,
      )
      .get(options.sourceId);
    return row !== undefined;
  });
}

export async function deleteSqliteSourceData(
  options: SqliteSourceDataOptions,
): Promise<void> {
  await runSqliteTransaction(options.database, async () => {
    for (const tableName of options.tableNames) {
      throwIfOperationAborted();
      const table = quoteSqliteIdentifier(tableName);
      const sourceIdColumn = quoteSqliteIdentifier('source_id');
      const key = getDeletionKeyColumns(options.database, tableName);
      if (key.length === 0) {
        // Preserve support for application tables that shadow every rowid alias.
        options.database
          .prepare(`DELETE FROM ${table} WHERE ${sourceIdColumn} = ?`)
          .run(options.sourceId);
        await setImmediate();
        throwIfOperationAborted();
        continue;
      }
      const keyColumns = key.map(quoteSqliteIdentifier).join(', ');
      const statement = options.database.prepare(
        `DELETE FROM ${table} WHERE (${keyColumns}) IN (SELECT ${keyColumns} FROM ${table} WHERE ${sourceIdColumn} = ? LIMIT ?)`,
      );
      let deleted: number;
      do {
        deleted = statement.run(options.sourceId, DELETE_BATCH_SIZE).changes;
        await setImmediate();
        throwIfOperationAborted();
      } while (deleted >= DELETE_BATCH_SIZE);
    }
  });
}
