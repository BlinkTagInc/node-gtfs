import * as tables from './tables/index.ts';
import {
  compileTable,
  getTableName,
  type CompiledGtfsColumn,
  type CompiledGtfsTable,
} from './compile-table.ts';
import { gtfsNamespaces, type GtfsTableDefinition } from './define-table.ts';

type CompiledTableRegistry = {
  [Name in keyof typeof tables]: CompiledGtfsTable & (typeof tables)[Name];
};

export type FileBackedCompiledGtfsTable = CompiledGtfsTable & {
  file: string;
};

const namespaceOrder = new Map(
  gtfsNamespaces.map((namespace, index) => [namespace, index]),
);

function compareTableDefinitions(
  left: GtfsTableDefinition,
  right: GtfsTableDefinition,
): number {
  const namespaceDifference =
    namespaceOrder.get(left.namespace)! - namespaceOrder.get(right.namespace)!;
  if (namespaceDifference !== 0) return namespaceDifference;

  const leftName = getTableName(left);
  const rightName = getTableName(right);
  return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
}

const tableEntries = Object.entries(tables).sort(([, left], [, right]) =>
  compareTableDefinitions(left, right),
);

export const tableDefinitions = tableEntries.map(
  ([, definition]) => definition,
) as GtfsTableDefinition[];

export const compiledTableRegistry = Object.fromEntries(
  tableEntries.map(([name, definition]) => [name, compileTable(definition)]),
) as CompiledTableRegistry;

export const compiledTables = Object.values(
  compiledTableRegistry,
) as CompiledGtfsTable[];

export const fileBackedTables: FileBackedCompiledGtfsTable[] =
  compiledTables.filter(
    (table): table is FileBackedCompiledGtfsTable => table.file !== null,
  );

export type ColumnStorageKinds = Readonly<
  Record<string, CompiledGtfsColumn['storageKind']>
>;

const columnStorageKindsByTable = new Map<string, ColumnStorageKinds>(
  compiledTables.map((table) => [
    table.name,
    Object.fromEntries(
      table.columns.map((column) => [column.name, column.storageKind]),
    ),
  ]),
);

export function getColumnStorageKinds(
  tableName: string,
): ColumnStorageKinds | undefined {
  return columnStorageKindsByTable.get(tableName);
}
