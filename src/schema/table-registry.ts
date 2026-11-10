import * as tables from './tables/index.ts';
import { tableStoragePolicies } from '../database/storage/table-policy.ts';
import { toManagedGtfsTable } from '../database/storage/table-definition.ts';
import { compileTable, type CompiledGtfsTable } from './compile-table.ts';
import {
  gtfsSpecifications,
  type GtfsTableDefinition,
} from './define-table.ts';

type CompiledTableRegistry = {
  readonly [Name in keyof typeof tables]: CompiledGtfsTable &
    (typeof tables)[Name];
};

export type FileBackedCompiledGtfsTable = CompiledGtfsTable & {
  readonly filename: string;
};

function compareTableDefinitions(
  left: GtfsTableDefinition,
  right: GtfsTableDefinition,
): number {
  const specificationDifference =
    gtfsSpecifications.indexOf(left.specification) -
    gtfsSpecifications.indexOf(right.specification);
  if (specificationDifference !== 0) {
    return specificationDifference;
  }

  const leftName = left.tableName;
  const rightName = right.tableName;
  return leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
}

const tableEntries = Object.entries(tables)
  .map(
    ([name, definition]) =>
      [
        name,
        toManagedGtfsTable(
          definition,
          tableStoragePolicies[definition.tableName],
        ) as GtfsTableDefinition,
      ] as const,
  )
  .sort(([, left], [, right]) => compareTableDefinitions(left, right));

export const tableDefinitions: readonly GtfsTableDefinition[] = Object.freeze(
  tableEntries.map(([, definition]) => Object.freeze(definition)),
);

export const compiledTableRegistry = Object.freeze(
  Object.fromEntries(
    tableEntries.map(([name, definition]) => [name, compileTable(definition)]),
  ),
) as CompiledTableRegistry;

export const compiledTables: readonly CompiledGtfsTable[] = Object.freeze(
  Object.values(compiledTableRegistry),
);

export const fileBackedTables: readonly FileBackedCompiledGtfsTable[] =
  Object.freeze(
    compiledTables.filter(
      (table): table is FileBackedCompiledGtfsTable => table.filename !== null,
    ),
  );
