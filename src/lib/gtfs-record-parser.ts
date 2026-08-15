import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse';

import type { Model } from '../types/global_interfaces.ts';
import { isValidJSON } from './geojson-utils.ts';
import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';
import { padLeadingZeros } from './utils.ts';

export type NormalizedGtfsRow = (string | null)[];

export interface NormalizedGtfsRowBatch {
  rows: NormalizedGtfsRow[];
  totalRowCount: number;
  isFinal: boolean;
}

interface ParseGtfsFileOptions {
  filepath: string;
  model: Model;
  csvOptions: object;
  fillEmptyAgencyId: boolean;
  agencyId?: string;
  batchSize: number;
}

const AGENCY_ID_BACKFILL_MODELS = new Set([
  'agency',
  'routes',
  'fare_attributes',
  'trip_capacity',
  'rider_trip',
  'ridership',
]);

function shouldBackfillAgencyId(
  model: Model,
  normalizedRow: NormalizedGtfsRow,
  columnIndexes: Map<string, number>,
): boolean {
  if (AGENCY_ID_BACKFILL_MODELS.has(model.filenameBase)) {
    return true;
  }

  if (model.filenameBase === 'attributions') {
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
  model: Model,
  recordNumber: number,
  fillEmptyAgencyId: boolean,
  agencyId: string | undefined,
  columnIndexes: Map<string, number>,
): NormalizedGtfsRow {
  // The first data record is line 2 in a CSV file.
  const lineNumber = recordNumber + 1;
  const normalizedRow: NormalizedGtfsRow = new Array(model.schema.length);
  const filename = `${model.filenameBase}.${model.filenameExtension}`;

  for (let index = 0; index < model.schema.length; index++) {
    const { name, type, required } = model.schema[index];
    let value = record[name];

    if (value === '' || value === undefined || value === null) {
      normalizedRow[index] = null;

      if (required) {
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

    if (type === 'date') {
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
    } else if (type === 'time') {
      value = padLeadingZeros(value);
    }

    if (type === 'json') {
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
    shouldBackfillAgencyId(model, normalizedRow, columnIndexes)
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
          options.model,
          totalRowCount,
          options.fillEmptyAgencyId,
          options.agencyId,
          columnIndexes,
        ),
      );

      if (rows.length >= options.batchSize) {
        yield { rows, totalRowCount, isFinal: false };
        rows = [];
      }
    }

    if (rows.length > 0) {
      yield { rows, totalRowCount, isFinal: true };
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
    options.model.schema.map((column, index) => [column.name, index]),
  );

  if (options.model.filenameExtension === 'txt') {
    yield* parseTextGtfsFile(options, columnIndexes);
    return;
  }

  if (options.model.filenameExtension === 'geojson') {
    const data = await readFile(options.filepath, 'utf8');
    const filename = `${options.model.filenameBase}.${options.model.filenameExtension}`;
    if (!isValidJSON(data)) {
      throw new GtfsError(`Invalid JSON in ${filename}`, {
        code: GtfsErrorCode.GTFS_JSON_INVALID,
        category: GtfsErrorCategory.PARSE,
        details: { file: filename },
      });
    }

    yield {
      rows: [
        normalizeGtfsRecord(
          { geojson: data },
          options.model,
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

  const filename = `${options.model.filenameBase}.${options.model.filenameExtension}`;
  throw new GtfsError(
    `Unsupported file type: ${options.model.filenameExtension}`,
    {
      code: GtfsErrorCode.GTFS_UNSUPPORTED_FILE_TYPE,
      category: GtfsErrorCategory.PARSE,
      details: {
        file: filename,
        extension: options.model.filenameExtension,
      },
    },
  );
}
