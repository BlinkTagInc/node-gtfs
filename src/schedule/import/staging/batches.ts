import type Database from 'better-sqlite3';
import type {
  NormalizedImportRow,
  NormalizedGtfsValue,
} from '../../../values/normalize-row.ts';
import type { GtfsSourcePosition } from '../../../diagnostics/position.ts';
import {
  appendGtfsWorkingPosition,
  decodeGtfsWorkingBatch,
  encodeGtfsWorkingBatch,
  estimateGtfsWorkingRecordBytes,
  type WorkingRecord,
} from './codec.ts';

const MAX_BATCH_RECORDS = 1024;
const MAX_BATCH_BYTES = 1024 * 1024;

/** Sequential, bounded working batches; SQLite stores one blob per chunk, not per record. */
export function createGtfsWorkingBatches<
  Row extends NormalizedImportRow = NormalizedImportRow,
  Position extends GtfsSourcePosition = GtfsSourcePosition,
>(database: Database.Database, tableName: 'records' | 'reference_rows') {
  database.exec(`CREATE TABLE ${tableName} (
    filename TEXT, ordinal INTEGER, payload BLOB,
    PRIMARY KEY (filename, ordinal))`);
  const insert = database.prepare(`INSERT INTO ${tableName} VALUES (?, ?, ?)`);
  const read = database.prepare(
    `SELECT ordinal, payload FROM ${tableName}
     WHERE filename = ? AND ordinal > ? ORDER BY ordinal LIMIT 1`,
  );
  const lastOrdinals = new Map<string, number>();
  let filename: string | undefined;
  let batchRowFields: readonly string[] = [];
  let positionKind: GtfsSourcePosition['kind'] = 'csv';
  let batchRowValues: NormalizedGtfsValue[] = [];
  let encodedPositions: number[] = [];
  let pendingCount = 0;
  let estimatedBatchBytes = 0;

  function flush() {
    if (pendingCount === 0) {
      return;
    }
    if (filename === undefined) {
      throw new Error('Missing staged batch filename');
    }
    insert.run(
      filename,
      lastOrdinals.get(filename),
      encodeGtfsWorkingBatch({
        rowFields: batchRowFields,
        rowValues: batchRowValues,
        positionKind,
        encodedPositions,
      }),
    );
    batchRowValues = [];
    encodedPositions = [];
    pendingCount = 0;
    estimatedBatchBytes = 0;
  }

  function assertNextOrdinal(nextFilename: string, ordinal: number) {
    if (ordinal <= (lastOrdinals.get(nextFilename) ?? 0)) {
      throw new Error(`Staged ${nextFilename} record ordinals must increase`);
    }
  }

  return {
    flush,
    assertNextOrdinal,
    append(
      nextFilename: string,
      ordinal: number,
      record: WorkingRecord<Row, Position>,
    ) {
      assertNextOrdinal(nextFilename, ordinal);
      const rowFields = Object.keys(record.row);
      if (
        filename !== nextFilename ||
        positionKind !== record.position.kind ||
        batchRowFields.length !== rowFields.length ||
        rowFields.some((field, index) => field !== batchRowFields[index])
      ) {
        flush();
        filename = nextFilename;
        batchRowFields = rowFields;
        positionKind = record.position.kind;
      }
      // Bound both record count and estimated heap size, apart from a single
      // oversized input record. Values are normalized scalars or raw CSV strings.
      const rowValues = Object.values(record.row);
      const estimatedRecordBytes = estimateGtfsWorkingRecordBytes(rowValues);
      if (estimatedBatchBytes + estimatedRecordBytes > MAX_BATCH_BYTES) {
        flush();
      }
      for (const value of rowValues) {
        batchRowValues.push(value);
      }
      appendGtfsWorkingPosition(encodedPositions, record.position);
      pendingCount += 1;
      estimatedBatchBytes += estimatedRecordBytes;
      lastOrdinals.set(filename, ordinal);
      if (
        pendingCount >= MAX_BATCH_RECORDS ||
        estimatedBatchBytes >= MAX_BATCH_BYTES
      ) {
        flush();
      }
    },
    *records(sourceFilename: string): Generator<WorkingRecord<Row, Position>> {
      flush();
      let ordinal = 0;
      while (true) {
        // Complete the SELECT before yielding; consumers can write notices on
        // this connection or abandon iteration without leaving a cursor open.
        const batch = read.get(sourceFilename, ordinal) as
          { ordinal: number; payload: Buffer } | undefined;
        if (batch === undefined) {
          return;
        }
        ordinal = batch.ordinal;
        yield* decodeGtfsWorkingBatch<Row, Position>(batch.payload);
      }
    },
  };
}
