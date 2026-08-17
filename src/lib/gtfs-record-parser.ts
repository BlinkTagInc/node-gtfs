import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse';

import type {
  CompiledGtfsColumn,
  CompiledGtfsTable,
} from '../schema/compile-table.ts';
import { isValidJSON } from './geojson-utils.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';
import { padLeadingZeros } from './utils.ts';

export type NormalizedGtfsRow = (string | number | null)[];

export interface NormalizedGtfsRowBatch {
  table: CompiledGtfsTable;
  columns: readonly CompiledGtfsColumn[];
  rows: readonly NormalizedGtfsRow[];
  totalRowCount: number;
  isFinal: boolean;
}

interface ParseGtfsFileOptions {
  filepath: string;
  table: CompiledGtfsTable;
  csvOptions: object;
  fillEmptyAgencyId: boolean;
  agencyId?: string;
  batchSize: number;
}

const AGENCY_ID_BACKFILL_TABLES = new Set([
  'agency',
  'routes',
  'fare_attributes',
  'trip_capacity',
  'rider_trip',
  'ridership',
]);

function shouldBackfillAgencyId(
  table: CompiledGtfsTable,
  normalizedRow: NormalizedGtfsRow,
  columnIndexes: Map<string, number>,
): boolean {
  if (AGENCY_ID_BACKFILL_TABLES.has(table.name)) {
    return true;
  }

  if (table.name === 'attributions') {
    const routeIdIndex = columnIndexes.get('route_id');
    const tripIdIndex = columnIndexes.get('trip_id');
    return (
      (routeIdIndex === undefined || normalizedRow[routeIdIndex] == null) &&
      (tripIdIndex === undefined || normalizedRow[tripIdIndex] == null)
    );
  }

  return false;
}

function normalizeGtfsRecord(
  record: Record<string, string | null>,
  table: CompiledGtfsTable,
  recordNumber: number,
  fillEmptyAgencyId: boolean,
  agencyId: string | undefined,
  columnIndexes: Map<string, number>,
): NormalizedGtfsRow {
  // The first data record is line 2 in a CSV file.
  const lineNumber = recordNumber + 1;
  const normalizedRow: NormalizedGtfsRow = new Array(table.columns.length);
  const filename = table.file ?? table.name;

  for (let index = 0; index < table.columns.length; index++) {
    const { name, storageKind, presence, defaultValue } = table.columns[index];
    let value: string | number | null | undefined = record[name];

    if (value === '' || value === undefined || value === null) {
      value = defaultValue;

      if (value === undefined || value === null) {
        normalizedRow[index] = null;

        if (presence === 'required') {
          throw new GtfsError(
            `Missing required value in ${filename} for ${name} on line ${lineNumber}.`,
            {
              code: GtfsErrorCode.GTFS_REQUIRED_FIELD_MISSING,
              category: GtfsErrorCategory.VALIDATION,
              details: { file: filename, line: lineNumber, column: name },
            },
          );
        }
        continue;
      }
    }

    if (storageKind === 'date') {
      value = value.toString().replace(/-/g, '');
      if (value.length !== 8) {
        throw new GtfsError(
          `Invalid date in ${filename} for ${name} on line ${lineNumber}.`,
          {
            code: GtfsErrorCode.GTFS_INVALID_DATE,
            category: GtfsErrorCategory.VALIDATION,
            details: { file: filename, line: lineNumber, column: name, value },
          },
        );
      }
    } else if (storageKind === 'time') {
      value = padLeadingZeros(String(value));
    }

    if (storageKind === 'json') {
      value = JSON.stringify(value);
    }

    normalizedRow[index] = value;
  }

  const agencyIdIndex = columnIndexes.get('agency_id');
  if (
    fillEmptyAgencyId &&
    agencyId !== undefined &&
    agencyIdIndex !== undefined &&
    normalizedRow[agencyIdIndex] == null &&
    shouldBackfillAgencyId(table, normalizedRow, columnIndexes)
  ) {
    normalizedRow[agencyIdIndex] = agencyId;
  }

  return normalizedRow;
}

async function* parseTextGtfsFile(
  options: ParseGtfsFileOptions,
  columnIndexes: Map<string, number>,
): AsyncGenerator<NormalizedGtfsRowBatch> {
  const parser = parse({
    columns: true,
    relax_quotes: true,
    trim: true,
    skip_empty_lines: true,
    bom: true,
    ...options.csvOptions,
  });
  const inputStream = createReadStream(options.filepath);
  inputStream.on('error', (error) => parser.destroy(error));
  inputStream.pipe(parser);

  let rows: NormalizedGtfsRow[] = [];
  let totalRowCount = 0;

  try {
    for await (const record of parser) {
      totalRowCount += 1;
      rows.push(
        normalizeGtfsRecord(
          record as Record<string, string | null>,
          options.table,
          totalRowCount,
          options.fillEmptyAgencyId,
          options.agencyId,
          columnIndexes,
        ),
      );

      if (rows.length >= options.batchSize) {
        yield {
          table: options.table,
          columns: options.table.columns,
          rows,
          totalRowCount,
          isFinal: false,
        };
        rows = [];
      }
    }

    if (rows.length > 0) {
      yield {
        table: options.table,
        columns: options.table.columns,
        rows,
        totalRowCount,
        isFinal: true,
      };
    }
  } finally {
    inputStream.destroy();
    parser.destroy();
  }
}

export async function* parseGtfsFile(
  options: ParseGtfsFileOptions,
): AsyncGenerator<NormalizedGtfsRowBatch> {
  const columnIndexes = new Map(
    options.table.columns.map((column, index) => [column.name, index]),
  );

  const filename = options.table.file ?? options.table.name;
  const fileExtension = path.extname(filename).slice(1);

  if (fileExtension === 'txt') {
    yield* parseTextGtfsFile(options, columnIndexes);
    return;
  }

  if (fileExtension === 'geojson') {
    const data = await readFile(options.filepath, 'utf8');
    if (!isValidJSON(data)) {
      throw new GtfsError(`Invalid JSON in ${filename}`, {
        code: GtfsErrorCode.GTFS_JSON_INVALID,
        category: GtfsErrorCategory.PARSE,
        details: { file: filename },
      });
    }

    yield {
      table: options.table,
      columns: options.table.columns,
      rows: [
        normalizeGtfsRecord(
          { geojson: data },
          options.table,
          1,
          options.fillEmptyAgencyId,
          options.agencyId,
          columnIndexes,
        ),
      ],
      totalRowCount: 1,
      isFinal: true,
    };
    return;
  }

  throw new GtfsError(`Unsupported file type: ${fileExtension}`, {
    code: GtfsErrorCode.GTFS_UNSUPPORTED_FILE_TYPE,
    category: GtfsErrorCategory.PARSE,
    details: {
      file: filename,
      extension: fileExtension,
    },
  });
}
