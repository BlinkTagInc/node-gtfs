import {
  getServiceDaySecondsFieldName,
  type CompiledGtfsColumn,
  type CompiledGtfsTable,
} from '../schema/compile-table.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import {
  parseGtfsPrimitiveValue,
  type GtfsPrimitiveParseResult,
} from './parse.ts';
import {
  formatGtfsSourcePosition,
  type GtfsSourcePosition,
} from '../diagnostics/position.ts';

export type NormalizedGtfsValue = string | number | bigint | null;

/** Backend-neutral storage row produced before dispatch to a database writer. */
export type NormalizedImportRow = Readonly<Record<string, NormalizedGtfsValue>>;

interface NormalizeGtfsRecordOptions {
  readonly position: GtfsSourcePosition;
  readonly sourceId: string;
  readonly defaultAgencyId?: string;
  readonly onUnknownField?: 'reject' | 'preserve' | 'discard';
  readonly parsedValues?: ReadonlyMap<string, GtfsPrimitiveParseResult>;
}

const AGENCY_ID_BACKFILL_TABLES = new Set([
  'agency',
  'routes',
  'fare_attributes',
  'trip_capacity',
  'rider_trip',
  'ridership',
]);

interface GtfsNormalizationPlan {
  readonly knownFields: ReadonlySet<string>;
  readonly emptyRow: NormalizedImportRow;
  readonly columns: readonly {
    readonly column: CompiledGtfsColumn;
    readonly serviceTimeColumnName: string | undefined;
  }[];
  readonly monetaryColumns: readonly CompiledGtfsColumn[];
}

const normalizationPlans = new WeakMap<
  CompiledGtfsTable,
  GtfsNormalizationPlan
>();

function getGtfsNormalizationPlan(
  table: CompiledGtfsTable,
): GtfsNormalizationPlan {
  let plan = normalizationPlans.get(table);
  if (plan === undefined) {
    const columns = table.columns;
    const rowFields = ['source_id'];
    for (const column of columns) {
      rowFields.push(column.name);
      if (column.valueKind === 'time') {
        rowFields.push(getServiceDaySecondsFieldName(column.name));
      }
    }
    plan = {
      knownFields: new Set(columns.map(({ name }) => name)),
      // Predeclaring wide rows avoids V8 dictionary-mode properties during
      // normalization and subsequent staging. The template never retains values.
      emptyRow: Object.freeze(
        Object.fromEntries(rowFields.map((name) => [name, null])),
      ),
      columns: columns.map((column) => ({
        column,
        serviceTimeColumnName:
          column.valueKind === 'time'
            ? getServiceDaySecondsFieldName(column.name)
            : undefined,
      })),
      monetaryColumns: columns.filter((column) => column.monetary),
    };
    normalizationPlans.set(table, plan);
  }
  return plan;
}

function shouldBackfillAgencyId(
  table: CompiledGtfsTable,
  row: NormalizedImportRow,
): boolean {
  if (AGENCY_ID_BACKFILL_TABLES.has(table.tableName)) {
    return true;
  }
  if (table.tableName !== 'attributions') {
    return false;
  }
  return row.route_id == null && row.trip_id == null;
}

function normalizeScheduleFieldValue(
  value: unknown,
  column: CompiledGtfsColumn,
  context: {
    readonly table: CompiledGtfsTable;
    readonly position: GtfsSourcePosition;
    readonly row: NormalizedImportRow;
    readonly parsedValues?: ReadonlyMap<string, GtfsPrimitiveParseResult>;
  },
): Extract<GtfsPrimitiveParseResult, { valid: true }> {
  const parsed =
    (!column.monetary ? context.parsedValues?.get(column.name) : undefined) ??
    parseGtfsPrimitiveValue(value, column, context.row);
  if (parsed.valid) {
    return parsed;
  }
  const { table, position } = context;
  const filename = table.filename ?? table.tableName;
  const invalidDate = parsed.reason === 'invalid-date';
  throw new GtfsError(
    invalidDate
      ? `Invalid date for ${filename}.${column.name} at ${formatGtfsSourcePosition(position)}; expected YYYYMMDD`
      : `Invalid ${column.kind} value for ${filename}.${column.name} at ${formatGtfsSourcePosition(position)}`,
    {
      code: invalidDate
        ? GtfsErrorCode.INVALID_DATE
        : GtfsErrorCode.INVALID_VALUE,
      category: GtfsErrorCategory.VALIDATION,
      position,
      details: {
        filename,
        field: column.name,
        value,
        ...(invalidDate ? {} : { expectedKind: column.kind }),
      },
    },
  );
}

/**
 * Normalizes a parsed GTFS record once, including defaults, source transforms,
 * primitive coercion, and generated service-time values.
 */
export function normalizeGtfsRecord(
  record: Readonly<Record<string, unknown>>,
  table: CompiledGtfsTable,
  options: NormalizeGtfsRecordOptions,
): NormalizedImportRow {
  const { position } = options;
  const filename = table.filename ?? table.tableName;
  const plan = getGtfsNormalizationPlan(table);
  const row: Record<string, NormalizedGtfsValue> = {
    ...plan.emptyRow,
    source_id: options.sourceId,
  };
  const context = {
    table,
    position,
    row,
    ...(options.parsedValues === undefined
      ? {}
      : { parsedValues: options.parsedValues }),
  };

  for (const { column, serviceTimeColumnName } of plan.columns) {
    let value = record[column.name];
    if (value === '' || value === undefined || value === null) {
      value = column.defaultValue;
      if (value === undefined || value === null) {
        row[column.name] = null;
        if (serviceTimeColumnName !== undefined) {
          row[serviceTimeColumnName] = null;
        }
        if (column.presence === 'required') {
          throw new GtfsError(
            `Missing required value for ${filename}.${column.name} at ${formatGtfsSourcePosition(position)}`,
            {
              code: GtfsErrorCode.REQUIRED_VALUE_MISSING,
              category: GtfsErrorCategory.VALIDATION,
              position,
              details: {
                filename,
                field: column.name,
              },
            },
          );
        }
        continue;
      }
    }

    // Monetary conversion waits until currency fields and their defaults are set.
    if (column.monetary) {
      row[column.name] = String(value);
    } else {
      const parsed = normalizeScheduleFieldValue(value, column, context);
      row[column.name] = parsed.value;
      if (serviceTimeColumnName !== undefined) {
        row[serviceTimeColumnName] = parsed.serviceDaySeconds ?? null;
      }
    }
  }

  if (
    options.defaultAgencyId !== undefined &&
    'agency_id' in row &&
    row.agency_id == null &&
    shouldBackfillAgencyId(table, row)
  ) {
    row.agency_id = options.defaultAgencyId;
  }

  for (const column of plan.monetaryColumns) {
    if (row[column.name] === null) {
      continue;
    }
    row[column.name] = normalizeScheduleFieldValue(
      row[column.name],
      column,
      context,
    ).value;
  }

  if (options.onUnknownField === 'preserve') {
    let unknownValues: Record<string, unknown> | undefined;
    for (const field of Object.keys(record)) {
      if (!plan.knownFields.has(field) && record[field] !== undefined) {
        unknownValues ??= Object.create(null) as Record<string, unknown>;
        unknownValues[field] = record[field];
      }
    }
    row._unknown_fields =
      unknownValues === undefined ? null : JSON.stringify(unknownValues);
  }

  return Object.freeze(row);
}
