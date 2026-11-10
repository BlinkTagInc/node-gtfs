import type { GtfsPhysicalStorageRow } from '../storage/row-projection.ts';

export async function insertMysqlRowsKeepingFirst({
  rows,
  insert,
}: {
  readonly rows: readonly GtfsPhysicalStorageRow[];
  readonly insert: (rows: readonly GtfsPhysicalStorageRow[]) => Promise<void>;
}): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  try {
    await insert(rows);
    return 0;
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ER_DUP_ENTRY'
    ) {
      throw error;
    }
    if (rows.length === 1) {
      return 1;
    }
  }
  // InnoDB rolls back the failing INSERT, not the surrounding transaction.
  // Retry left before right to preserve input order. Splitting only on duplicate
  // errors avoids INSERT IGNORE's coercions and FOUND_ROWS-dependent noop counts.
  const middle = Math.floor(rows.length / 2);
  const left = await insertMysqlRowsKeepingFirst({
    rows: rows.slice(0, middle),
    insert,
  });
  const right = await insertMysqlRowsKeepingFirst({
    rows: rows.slice(middle),
    insert,
  });
  return left + right;
}
