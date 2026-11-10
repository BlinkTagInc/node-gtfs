import { readFile } from 'node:fs/promises';
import { cancellationCheckpoint } from '../../cancellation.ts';
import path from 'node:path';

import type { FileBackedCompiledGtfsTable } from '../../schema/table-registry.ts';
import { readGtfsCsvRecordBatches } from './csv.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  toGtfsError,
} from '../../diagnostics/errors.ts';
import { parseLocationsGeoJSON } from './locations.ts';
import type { GtfsSourcePosition } from '../../diagnostics/position.ts';
import type { GtfsCsvParseOptions } from '../../types/config.ts';

interface GtfsSourceRecord {
  readonly record: Readonly<Record<string, unknown>>;
  readonly validationRecord: Readonly<Record<string, string>>;
  readonly position: Exclude<GtfsSourcePosition, { kind: 'realtime' }>;
}

export async function* readGtfsSourceRecordBatches({
  filePath,
  table,
  csv,
  onHeaders,
}: {
  readonly filePath: string;
  readonly table: FileBackedCompiledGtfsTable;
  readonly csv: GtfsCsvParseOptions;
  readonly onHeaders: (headers: readonly string[]) => void;
}): AsyncGenerator<readonly GtfsSourceRecord[]> {
  try {
    if (/\.(?:txt|csv)$/i.test(table.filename)) {
      let foundHeaders = false;
      for await (const batch of readGtfsCsvRecordBatches(
        filePath,
        csv,
        (headers) => {
          foundHeaders = true;
          onHeaders(headers);
        },
      )) {
        yield batch.map(({ record, position }) => ({
          record,
          validationRecord: record,
          position,
        }));
      }
      if (!foundHeaders) {
        onHeaders([]);
      }
      return;
    }
    if (table.filename !== 'locations.geojson') {
      const extension = path.extname(table.filename);
      throw new GtfsError(
        `Unsupported GTFS file extension ${JSON.stringify(extension)} for ${JSON.stringify(table.filename)}`,
        {
          code: GtfsErrorCode.UNSUPPORTED_FILE_TYPE,
          category: GtfsErrorCategory.PARSE,
          details: {
            filename: table.filename,
            extension: extension.slice(1),
          },
        },
      );
    }
    await cancellationCheckpoint();
    const features = parseLocationsGeoJSON(
      await readFile(filePath, 'utf8'),
      table.filename,
    );
    await cancellationCheckpoint();
    const headers = new Set(table.columns.map(({ name }) => name));
    for (const feature of features) {
      for (const field of Object.keys(feature)) {
        headers.add(field);
      }
    }
    onHeaders([...headers]);
    let batch: GtfsSourceRecord[] = [];
    for (const [index, record] of features.entries()) {
      batch.push({
        record,
        validationRecord: Object.fromEntries(
          Object.entries(record).map(([field, value]) => [
            field,
            value == null
              ? ''
              : typeof value === 'string'
                ? value
                : JSON.stringify(value),
          ]),
        ),
        position: { kind: 'geojson', featureNumber: index + 1 },
      });
      if (batch.length === 512) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) {
      yield batch;
    }
  } catch (error: unknown) {
    throw toGtfsError(error, {
      message: `Could not parse ${table.filename}`,
      code: GtfsErrorCode.CSV_PARSE_FAILED,
      category: GtfsErrorCategory.PARSE,
      details: { filename: table.filename },
    });
  }
}
