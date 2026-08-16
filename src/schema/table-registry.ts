import * as tables from './tables/index.ts';
import { compileTable, type CompiledGtfsTable } from './compile-table.ts';
import type { GtfsTableDefinition } from './define-table.ts';

type CompiledTableRegistry = {
  [Name in keyof typeof tables]: CompiledGtfsTable & (typeof tables)[Name];
};

export type FileBackedCompiledGtfsTable = CompiledGtfsTable & {
  file: string;
};

export const tableDefinitions = Object.values(tables) as GtfsTableDefinition[];

export const compiledTableRegistry = Object.fromEntries(
  Object.entries(tables).map(([name, definition]) => [
    name,
    compileTable(definition),
  ]),
) as CompiledTableRegistry;

export const compiledTables = Object.values(
  compiledTableRegistry,
) as CompiledGtfsTable[];

export const fileBackedTables: FileBackedCompiledGtfsTable[] =
  compiledTables.filter(
    (table): table is FileBackedCompiledGtfsTable => table.file !== null,
  );
