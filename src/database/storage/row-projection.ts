import { createHash } from 'node:crypto';

import { getGtfsCanonicalKeyDigest } from './key.ts';
import type { GtfsStorageColumnPlan, GtfsTableStoragePlan } from './plan.ts';
import { foldGtfsText } from '../../values/case-fold.ts';

export type GtfsPhysicalStorageRow = Record<string, unknown>;

export function createGtfsStorageValuesProjector(
  tablePlan: GtfsTableStoragePlan,
  columns: readonly GtfsStorageColumnPlan[],
): (row: Readonly<Record<string, unknown>>) => unknown[] {
  const directColumns: { index: number; name: string }[] = [];
  const derivedColumns: {
    index: number;
    read: (row: Readonly<Record<string, unknown>>) => unknown;
  }[] = [];
  for (const [index, column] of columns.entries()) {
    if (
      column.role === 'case-fold' ||
      column.role === 'canonical-key' ||
      column.role === 'storage-key-hash'
    ) {
      derivedColumns.push({
        index,
        read: createGtfsStorageColumnReader(tablePlan, column),
      });
    } else {
      directColumns.push({ index, name: column.name });
    }
  }
  return (row) => {
    const values = new Array<unknown>(columns.length);
    for (const { index, name } of directColumns) {
      values[index] = row[name] ?? null;
    }
    for (const { index, read } of derivedColumns) {
      values[index] = read(row);
    }
    return values;
  };
}

export function createGtfsStorageRowProjector(
  tablePlan: GtfsTableStoragePlan,
  columns: readonly GtfsStorageColumnPlan[] = tablePlan.columns,
): (row: Readonly<Record<string, unknown>>) => GtfsPhysicalStorageRow {
  const mappings = columns.map((column) => ({
    name: column.name,
    read: createGtfsStorageColumnReader(tablePlan, column),
  }));
  return (row) => {
    const storedRow: GtfsPhysicalStorageRow = {};
    for (const { name, read } of mappings) {
      storedRow[name] = read(row);
    }
    return storedRow;
  };
}

function hashGtfsStorageKeyValues(values: readonly unknown[]): string {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

function createGtfsStorageColumnReader(
  tablePlan: GtfsTableStoragePlan,
  column: GtfsStorageColumnPlan,
): (row: Readonly<Record<string, unknown>>) => unknown {
  switch (column.role) {
    case 'source-id':
    case 'manifest':
    case 'service-time':
    case 'unknown-fields':
      return (row) => row[column.name] ?? null;
    case 'case-fold': {
      const sourceColumn = column.sourceColumn;
      if (sourceColumn === undefined) {
        throw new Error(
          `Case-fold storage column ${column.name} has no source column`,
        );
      }
      return (row) => {
        const value = row[sourceColumn.name];
        return value === null || value === undefined
          ? null
          : foldGtfsText(String(value));
      };
    }
    case 'canonical-key': {
      return (row) => {
        const digest = getGtfsCanonicalKeyDigest(tablePlan.table, row);
        if (digest === undefined) {
          throw new Error(
            `Canonical storage column ${column.name} belongs to a non-canonical table plan`,
          );
        }
        return digest;
      };
    }
    case 'storage-key-hash': {
      return (row) => {
        const values = tablePlan.storageKeyColumns.map(
          (field) => row[field] ?? null,
        );
        return values.includes(null) ? null : hashGtfsStorageKeyValues(values);
      };
    }
  }
}

const columnReaders = new WeakMap<
  GtfsTableStoragePlan,
  ReadonlyMap<
    GtfsStorageColumnPlan,
    ReturnType<typeof createGtfsStorageColumnReader>
  >
>();

export function projectGtfsStorageRow(
  tablePlan: GtfsTableStoragePlan,
  row: Readonly<Record<string, unknown>>,
  columns: readonly GtfsStorageColumnPlan[] = tablePlan.columns,
): GtfsPhysicalStorageRow {
  let readers = columnReaders.get(tablePlan);
  if (readers === undefined) {
    readers = new Map(
      tablePlan.columns.map((column) => [
        column,
        createGtfsStorageColumnReader(tablePlan, column),
      ]),
    );
    columnReaders.set(tablePlan, readers);
  }
  return Object.fromEntries(
    columns.map((column) => {
      const read =
        readers.get(column) ?? createGtfsStorageColumnReader(tablePlan, column);
      return [column.name, read(row)];
    }),
  );
}
