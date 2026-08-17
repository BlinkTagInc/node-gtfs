import type { Kysely } from 'kysely';

import { getTimestampColumnName } from '../schema/compile-table.ts';
import { fileBackedTables } from '../schema/table-registry.ts';

export interface GtfsTableSchemaIssue {
  table: string;
  missingTable: boolean;
  missingColumns: string[];
  unexpectedlyNullableColumns: string[];
  missingDefaultColumns: string[];
}

export interface GtfsSchemaInspection {
  compatible: boolean;
  tables: GtfsTableSchemaIssue[];
}

/** Compares a Kysely database to the manifest without modifying it. */
export async function inspectKyselyGtfsSchema<DB>(
  db: Kysely<DB>,
  options: { includeNodeGtfsExtras?: boolean } = {},
): Promise<GtfsSchemaInspection> {
  const metadata = await db.introspection.getTables({
    withInternalKyselyTables: false,
  });
  const tablesByName = new Map(metadata.map((table) => [table.name, table]));
  const issues: GtfsTableSchemaIssue[] = [];

  for (const definition of fileBackedTables) {
    const table = tablesByName.get(definition.name);
    const expectedColumns = [
      ...definition.columns.map((column) => column.name),
      ...(options.includeNodeGtfsExtras
        ? definition.columns
            .filter((column) => column.storageKind === 'time')
            .map((column) => getTimestampColumnName(column.name))
        : []),
    ];
    const columnsByName = new Map(
      table?.columns.map((column) => [column.name, column]) ?? [],
    );
    const missingColumns = expectedColumns.filter(
      (column) => !columnsByName.has(column),
    );
    const unexpectedlyNullableColumns = definition.columns
      .filter(
        (column) =>
          column.presence === 'required' &&
          columnsByName.get(column.name)?.isNullable === true,
      )
      .map((column) => column.name);
    const missingDefaultColumns = definition.columns
      .filter(
        (column) =>
          column.defaultValue !== undefined &&
          columnsByName.get(column.name) !== undefined &&
          columnsByName.get(column.name)?.hasDefaultValue === false,
      )
      .map((column) => column.name);

    if (
      !table ||
      missingColumns.length > 0 ||
      unexpectedlyNullableColumns.length > 0 ||
      missingDefaultColumns.length > 0
    ) {
      issues.push({
        table: definition.name,
        missingTable: !table,
        missingColumns,
        unexpectedlyNullableColumns,
        missingDefaultColumns,
      });
    }
  }

  return { compatible: issues.length === 0, tables: issues };
}
