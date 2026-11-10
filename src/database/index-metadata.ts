import type { GtfsPhysicalIndexMetadata } from './schema-metadata.ts';

export interface PhysicalIndexColumn {
  readonly name: string;
  readonly table_name: string;
  readonly column_name: string | null;
  readonly is_unique: number;
  readonly is_primary: number;
  readonly is_partial: number;
  readonly descending: number;
  readonly prefix_length: number | null;
  readonly predicate?: string | null;
}

export function groupPhysicalIndexes(
  rows: readonly PhysicalIndexColumn[],
): GtfsPhysicalIndexMetadata[] {
  const groups = new Map<
    string,
    [PhysicalIndexColumn, ...PhysicalIndexColumn[]]
  >();
  for (const row of rows) {
    const key = `${row.table_name}\0${row.name}`;
    const columns = groups.get(key);
    if (columns === undefined) {
      groups.set(key, [row]);
    } else {
      columns.push(row);
    }
  }
  return [...groups.values()].map((columns) => {
    const first = columns[0];
    return {
      name: first.name,
      tableName: first.table_name,
      columns: columns.map((column) => column.column_name ?? ''),
      unique: Number(first.is_unique) === 1,
      primary: Number(first.is_primary) === 1,
      partial: Number(first.is_partial) === 1,
      predicate: first.predicate ?? null,
      descending: columns.map((column) => Number(column.descending) === 1),
      prefixLengths: columns.map((column) =>
        column.prefix_length === null ? null : Number(column.prefix_length),
      ),
    };
  });
}
