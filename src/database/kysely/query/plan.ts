import {
  GTFS_SOURCE_ID_COLUMN,
  getServiceDaySecondsFieldName,
  type CompiledGtfsTable,
} from '../../../schema/compile-table.ts';
import { gtfsManifest } from '../../../schema/manifest.ts';
import { createGtfsQueryError } from '../../../diagnostics/errors.ts';
import { isNonNegativeNumber } from '../../../config/options.ts';
import type {
  PortableFindManyOptions,
  PortableQueryField,
  PortableQueryPlan,
} from './types.ts';

/** Time ordering uses numeric service-day seconds. */
export function getComparisonStorageName(field: PortableQueryField): string {
  return field.column?.valueKind === 'time'
    ? getServiceDaySecondsFieldName(field.publicName)
    : field.storageName;
}

export function getPortableQueryFields(
  table: CompiledGtfsTable,
): ReadonlyMap<string, PortableQueryField> {
  const fields = new Map<string, PortableQueryField>([
    [
      GTFS_SOURCE_ID_COLUMN,
      {
        publicName: GTFS_SOURCE_ID_COLUMN,
        storageName: GTFS_SOURCE_ID_COLUMN,
        column: null,
      },
    ],
  ]);

  for (const column of table.columns) {
    fields.set(column.name, {
      publicName: column.name,
      storageName: column.name,
      column,
    });
  }

  const manifest = gtfsManifest[table.tableName as keyof typeof gtfsManifest];
  if (manifest === undefined) {
    throw createGtfsQueryError(
      `Unknown GTFS table ${JSON.stringify(table.tableName)}`,
      { table: table.tableName },
    );
  }
  for (const [publicName, derived] of Object.entries(manifest.derivedFields)) {
    fields.set(publicName, {
      publicName,
      storageName: getServiceDaySecondsFieldName(derived.sourceField),
      column: null,
    });
  }

  return fields;
}

export function resolvePortableQueryField(
  fields: ReadonlyMap<string, PortableQueryField>,
  tableName: string,
  fieldName: string,
): PortableQueryField {
  const field = fields.get(fieldName);
  if (field === undefined) {
    throw createGtfsQueryError(
      `Unknown public field ${JSON.stringify(fieldName)} for GTFS table ${JSON.stringify(tableName)}`,
      { table: tableName, field: fieldName },
    );
  }
  return field;
}

function validatePageValue(
  name: 'limit' | 'offset',
  value: number | undefined,
): void {
  if (value === undefined) {
    return;
  }
  if (!isNonNegativeNumber(value, { integer: true })) {
    throw createGtfsQueryError(
      `\`${name}\` must be a non-negative safe integer`,
      { [name]: value },
    );
  }
}

export function compilePortableQueryPlan(
  table: CompiledGtfsTable,
  options: PortableFindManyOptions,
): PortableQueryPlan {
  const fields = getPortableQueryFields(table);
  const manifest = gtfsManifest[table.tableName as keyof typeof gtfsManifest];
  const selectedNames = options.select ?? manifest.defaultSelectedFields;
  if (selectedNames.length === 0) {
    throw createGtfsQueryError(
      '`select` must contain at least one public field',
      { table: table.tableName },
    );
  }
  const duplicateSelection = selectedNames.find(
    (field, index) => selectedNames.indexOf(field) !== index,
  );
  if (duplicateSelection !== undefined) {
    throw createGtfsQueryError(
      `Duplicate selected field ${JSON.stringify(duplicateSelection)}`,
      { table: table.tableName, field: duplicateSelection },
    );
  }

  validatePageValue('limit', options.limit);
  validatePageValue('offset', options.offset);

  const orderBy = (options.orderBy ?? []).map(
    ({ field, direction = 'asc' }) => {
      if (direction !== 'asc' && direction !== 'desc') {
        throw createGtfsQueryError(
          `Invalid sort direction ${JSON.stringify(direction)} for ${JSON.stringify(field)}; expected "asc" or "desc"`,
          {
            table: table.tableName,
            field,
            direction,
            expectedDirections: ['asc', 'desc'],
          },
        );
      }
      return {
        field: resolvePortableQueryField(fields, table.tableName, field),
        direction,
      };
    },
  );

  return {
    selectedFields: selectedNames.map((field) =>
      resolvePortableQueryField(fields, table.tableName, field),
    ),
    orderBy,
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    ...(options.offset === undefined ? {} : { offset: options.offset }),
  };
}
