import {
  cancellationCheckpoint,
  getOperationSignal,
  throwIfOperationAborted,
} from '../../cancellation.ts';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { stringify } from 'csv-stringify';
import { sql, type AliasedRawBuilder, type CompiledQuery } from 'kysely';

import {
  GTFS_UNKNOWN_FIELDS_COLUMN,
  GTFS_SOURCE_ID_COLUMN,
} from '../../schema/compile-table.ts';
import type { FileBackedCompiledGtfsTable } from '../../schema/table-registry.ts';
import { formatFileCount } from '../../reporting/format.ts';
import { status } from '../../reporting/report.ts';
import {
  GtfsErrorCategory,
  GtfsErrorCode,
  isGtfsError,
} from '../../diagnostics/errors.ts';
import { createGtfsExportError } from './error.ts';
import type { PortableExportContext } from './export.ts';
import type { PortableExportOptions, ResolvedExportSource } from './source.ts';
import { castMonetaryStorageToText } from '../../database/kysely/money.ts';
import { minorUnitsToDecimalString } from '../../values/money.ts';
import type { GtfsExportFileResult } from '../../types/export.ts';

type DynamicRow = Record<string, unknown>;

export interface PortableExportFilesResult {
  readonly files: readonly GtfsExportFileResult[];
  readonly emptyScheduleFiles: readonly string[];
}

interface PortableExportRun {
  readonly config: PortableExportOptions;
  readonly context: PortableExportContext;
  readonly source: ResolvedExportSource;
  readonly outputDirectory: string;
}

function createExportSelections(
  table: FileBackedCompiledGtfsTable,
  context: PortableExportContext,
  hasUnknownFieldsColumn: boolean,
): AliasedRawBuilder<unknown, string>[] {
  return [
    ...table.columns.map((column) =>
      column.monetary
        ? castMonetaryStorageToText(context.dialect, column.name).as(
            column.name,
          )
        : sql.ref(column.name).as(column.name),
    ),
    ...(hasUnknownFieldsColumn
      ? [sql.ref(GTFS_UNKNOWN_FIELDS_COLUMN).as(GTFS_UNKNOWN_FIELDS_COLUMN)]
      : []),
  ];
}

function streamExportRows(options: {
  context: PortableExportContext;
  table: FileBackedCompiledGtfsTable;
  sourceId: string;
  hasUnknownFieldsColumn: boolean;
  batchSize: number;
}): Iterable<DynamicRow> | AsyncIterable<DynamicRow> {
  const { context, table, sourceId, hasUnknownFieldsColumn, batchSize } =
    options;
  const query = context.database
    .selectFrom(table.tableName)
    .select(createExportSelections(table, context, hasUnknownFieldsColumn))
    .where(GTFS_SOURCE_ID_COLUMN, '=', sourceId);
  return iterateExportQuery({ context, query, batchSize });
}

function iterateExportQuery({
  context,
  query,
  batchSize,
}: {
  context: PortableExportContext;
  query: {
    compile(): CompiledQuery<DynamicRow>;
    stream(chunkSize: number): AsyncIterableIterator<DynamicRow>;
  };
  batchSize: number;
}): Iterable<DynamicRow> | AsyncIterable<DynamicRow> {
  // Only native connections can bypass per-row promises. Borrowed Kysely
  // clients retain their executor, plugins, and connection ownership.
  const sqlite = context.sqlite;
  if (sqlite !== undefined) {
    return (function* () {
      const compiled = query.compile();
      yield* sqlite
        .prepare(compiled.sql)
        .iterate(compiled.parameters) as IterableIterator<DynamicRow>;
    })();
  }
  return query.stream(batchSize);
}

async function tableHasRows(
  context: PortableExportContext,
  table: FileBackedCompiledGtfsTable,
  sourceId: string,
): Promise<boolean> {
  const row = await context.database
    .selectFrom(table.tableName)
    .select(GTFS_SOURCE_ID_COLUMN)
    .where(GTFS_SOURCE_ID_COLUMN, '=', sourceId)
    .limit(1)
    .executeTakeFirst();
  return row !== undefined;
}

function parseExportJSONObject(
  value: unknown,
  table: FileBackedCompiledGtfsTable,
): DynamicRow {
  if (value === null || value === undefined || value === '') {
    return {};
  }
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new TypeError('Expected a JSON object');
    }
    return parsed as DynamicRow;
  } catch (cause: unknown) {
    throw createGtfsExportError(
      `Invalid JSON in ${table.filename}._unknown_fields; export cannot continue`,
      {
        code: GtfsErrorCode.JSON_INVALID,
        category: GtfsErrorCategory.PARSE,
        details: { table: table.tableName, field: GTFS_UNKNOWN_FIELDS_COLUMN },
        cause,
      },
    );
  }
}

async function discoverUnknownExportFields(options: {
  context: PortableExportContext;
  table: FileBackedCompiledGtfsTable;
  sourceId: string;
  batchSize: number;
}): Promise<string[]> {
  const { context, table, sourceId, batchSize } = options;
  const physicalColumns = context.physicalColumns.get(table.tableName);
  if (!physicalColumns?.has(GTFS_UNKNOWN_FIELDS_COLUMN)) {
    return [];
  }

  const knownColumns = new Set(table.columns.map((column) => column.name));
  const unknownFields = new Set<string>();
  const query = context.database
    .selectFrom(table.tableName)
    .select(sql.ref(GTFS_UNKNOWN_FIELDS_COLUMN).as(GTFS_UNKNOWN_FIELDS_COLUMN))
    .where(GTFS_SOURCE_ID_COLUMN, '=', sourceId)
    .where(GTFS_UNKNOWN_FIELDS_COLUMN, 'is not', null);
  const rows = iterateExportQuery({ context, query, batchSize });

  let inspected = 0;
  for await (const row of rows) {
    if (inspected++ % 512 === 0) {
      await cancellationCheckpoint();
    }
    for (const field of Object.keys(
      parseExportJSONObject(row[GTFS_UNKNOWN_FIELDS_COLUMN], table),
    )) {
      if (!knownColumns.has(field)) {
        unknownFields.add(field);
      }
    }
  }
  return [...unknownFields];
}

function createExportRowNormalizer(
  table: FileBackedCompiledGtfsTable,
  unknownColumns: readonly string[],
  excludedColumns: ReadonlySet<string>,
): (raw: DynamicRow) => unknown[] {
  const columns = table.columns.filter(
    (column) => !excludedColumns.has(column.name),
  );
  // Ordered records avoid rebuilding an object and resolving CSV column paths
  // for every row. Keep these positions aligned with the exported header.
  return (raw) => {
    const row: unknown[] = [];
    for (const column of columns) {
      const value = raw[column.name];
      if (column.monetary && value !== null && value !== undefined) {
        row.push(
          minorUnitsToDecimalString(
            value as bigint | number | string,
            raw[column.monetary.currencyField],
          ),
        );
      } else {
        row.push(typeof value === 'bigint' ? value.toString() : value);
      }
    }

    const unknownValues = parseExportJSONObject(
      raw[GTFS_UNKNOWN_FIELDS_COLUMN],
      table,
    );
    for (const field of unknownColumns) {
      const value = Object.hasOwn(unknownValues, field)
        ? unknownValues[field]
        : undefined;
      row.push(typeof value === 'bigint' ? value.toString() : value);
    }
    return row;
  };
}

async function sourceRoutesUseAgencyId(
  context: PortableExportContext,
  sourceId: string,
): Promise<boolean> {
  const row = await context.database
    .selectFrom('routes')
    .select('agency_id')
    .where(GTFS_SOURCE_ID_COLUMN, '=', sourceId)
    .where('agency_id', 'is not', null)
    .limit(1)
    .executeTakeFirst();
  return row !== undefined;
}

async function writeGtfsDelimitedTable(options: {
  context: PortableExportContext;
  table: FileBackedCompiledGtfsTable;
  sourceId: string;
  filePath: string;
  batchSize: number;
}): Promise<number> {
  const { context, table, sourceId, filePath, batchSize } = options;
  const hasUnknownFieldsColumn =
    context.physicalColumns
      .get(table.tableName)
      ?.has(GTFS_UNKNOWN_FIELDS_COLUMN) ?? false;
  const unknownColumns = hasUnknownFieldsColumn
    ? await discoverUnknownExportFields({
        context,
        table,
        sourceId,
        batchSize,
      })
    : [];
  const excludedColumns =
    table.tableName === 'routes' &&
    !(await sourceRoutesUseAgencyId(context, sourceId))
      ? new Set(['agency_id'])
      : new Set<string>();
  const columns = [
    ...table.columns.map((column) => column.name),
    ...unknownColumns,
  ].filter((column) => !excludedColumns.has(column));
  const normalizeRow = createExportRowNormalizer(
    table,
    unknownColumns,
    excludedColumns,
  );

  let rowCount = 0;
  const rows = streamExportRows({
    context,
    table,
    sourceId,
    hasUnknownFieldsColumn,
    batchSize,
  });
  function* synchronousRecords(
    rows: Iterable<DynamicRow>,
  ): IterableIterator<unknown[]> {
    for (const raw of rows) {
      rowCount += 1;
      yield normalizeRow(raw);
    }
  }
  async function* asynchronousRecords(
    rows: Iterable<DynamicRow> | AsyncIterable<DynamicRow>,
  ): AsyncIterableIterator<unknown[]> {
    for await (const raw of rows) {
      if (rowCount % 512 === 0) {
        await cancellationCheckpoint();
      }
      throwIfOperationAborted();
      rowCount += 1;
      yield normalizeRow(raw);
    }
  }

  await pipeline(
    Readable.from(
      getOperationSignal() === undefined && Symbol.iterator in rows
        ? synchronousRecords(rows)
        : asynchronousRecords(rows),
    ),
    stringify({ columns, header: true }),
    createWriteStream(filePath),
  );
  return rowCount;
}

function parseExportGeometry(
  value: unknown,
  table: FileBackedCompiledGtfsTable,
): unknown {
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch (cause: unknown) {
    throw createGtfsExportError(
      `Invalid geometry JSON in ${table.filename}; export cannot continue`,
      {
        code: GtfsErrorCode.JSON_INVALID,
        category: GtfsErrorCategory.PARSE,
        details: { table: table.tableName, field: 'geometry' },
        cause,
      },
    );
  }
}

async function writeGtfsGeoJSONTable(options: {
  context: PortableExportContext;
  table: FileBackedCompiledGtfsTable;
  sourceId: string;
  filePath: string;
  batchSize: number;
}): Promise<number> {
  const { context, table, sourceId, filePath, batchSize } = options;
  const hasUnknownFieldsColumn =
    context.physicalColumns
      .get(table.tableName)
      ?.has(GTFS_UNKNOWN_FIELDS_COLUMN) ?? false;
  let rowCount = 0;

  async function* document(): AsyncIterableIterator<string> {
    yield '{\n  "type": "FeatureCollection",\n  "features": [';
    for await (const raw of streamExportRows({
      context,
      table,
      sourceId,
      hasUnknownFieldsColumn,
      batchSize,
    })) {
      if (rowCount % 512 === 0) {
        await cancellationCheckpoint();
      }
      const properties = parseExportJSONObject(
        raw[GTFS_UNKNOWN_FIELDS_COLUMN],
        table,
      );
      if (raw.stop_name !== null && raw.stop_name !== undefined) {
        properties.stop_name = raw.stop_name;
      }
      if (raw.stop_desc !== null && raw.stop_desc !== undefined) {
        properties.stop_desc = raw.stop_desc;
      }
      const feature = {
        type: 'Feature',
        id: raw.id,
        properties,
        geometry: parseExportGeometry(raw.geometry, table),
      };
      yield `${rowCount === 0 ? '' : ','}\n    ${JSON.stringify(feature)}`;
      rowCount += 1;
    }
    yield '\n  ]\n}\n';
  }

  await pipeline(Readable.from(document()), createWriteStream(filePath));
  return rowCount;
}

async function writePortableExportTable(
  run: PortableExportRun,
  table: FileBackedCompiledGtfsTable,
): Promise<number> {
  const fileExtension = path.extname(table.filename).slice(1);
  const options = {
    context: run.context,
    table,
    sourceId: run.source.sourceId,
    filePath: path.join(run.outputDirectory, table.filename),
    batchSize: run.config.batchSize,
  };
  try {
    if (fileExtension === 'txt' || fileExtension === 'csv') {
      return await writeGtfsDelimitedTable(options);
    }
    if (fileExtension === 'geojson') {
      return await writeGtfsGeoJSONTable(options);
    }

    throw createGtfsExportError(
      `Unsupported GTFS file extension ${JSON.stringify(`.${fileExtension}`)} for ${JSON.stringify(table.filename)}`,
      {
        code: GtfsErrorCode.UNSUPPORTED_FILE_TYPE,
        category: GtfsErrorCategory.PARSE,
        details: { filename: table.filename, extension: fileExtension },
      },
    );
  } catch (cause: unknown) {
    if (isGtfsError(cause)) {
      throw cause;
    }
    throw createGtfsExportError(
      `Could not write ${JSON.stringify(table.filename)}; export cannot continue`,
      {
        code: GtfsErrorCode.EXPORT_WRITE_FAILED,
        category: GtfsErrorCategory.EXPORT,
        details: {
          filename: table.filename,
          outputDirectory: run.outputDirectory,
        },
        cause,
      },
    );
  }
}

export async function writePortableExportFiles(options: {
  run: PortableExportRun;
  enabledTables: readonly FileBackedCompiledGtfsTable[];
}): Promise<PortableExportFilesResult> {
  const { run, enabledTables } = options;
  const files: GtfsExportFileResult[] = [];
  const emptyScheduleFiles: string[] = [];
  status(run.config, 'Exporting GTFS files', { phase: 'start' });

  for (const table of enabledTables) {
    await cancellationCheckpoint();
    if (!(await tableHasRows(run.context, table, run.source.sourceId))) {
      if (table.specification === 'gtfs-schedule') {
        emptyScheduleFiles.push(table.filename);
      }
      continue;
    }

    status(run.config, `Exporting ${table.filename}`, {
      phase: 'start',
      operation: 'export',
      sourceId: run.source.sourceId,
      filename: table.filename,
    });
    const recordCount = await writePortableExportTable(run, table);
    files.push(Object.freeze({ filename: table.filename, recordCount }));
    status(run.config, formatFileCount(table.filename, recordCount), {
      phase: 'complete',
      operation: 'export',
      sourceId: run.source.sourceId,
      filename: table.filename,
    });
  }

  return Object.freeze({
    files: Object.freeze(files),
    emptyScheduleFiles: Object.freeze(emptyScheduleFiles),
  });
}
