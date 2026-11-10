import Database from 'better-sqlite3';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { serialize, deserialize } from 'node:v8';

import type { FileBackedCompiledGtfsTable } from '../../../schema/table-registry.ts';
import type { GtfsValidationNotice } from '../../../diagnostics/errors.ts';
import type {
  NormalizedImportRecord,
  NormalizedImportRowBatch,
} from '../records.ts';
import { getStorageKeyColumnNames } from '../../../schema/compile-table.ts';
import { encodeGtfsCanonicalKey } from '../../../database/storage/key.ts';
import type { GtfsValidationSourceRecord } from '../../../validation/types.ts';
import { createGtfsWorkingBatches } from './batches.ts';
import { createGtfsValidationKeyStore } from './key-store.ts';
import { createGtfsValidationReferenceStore } from './reference-store.ts';
import { createGtfsShapeRequirements } from '../../../validation/shapes.ts';
import {
  collectValidationNotice,
  createValidationSummary,
  freezeValidationSummary,
} from '../../../validation/summary.ts';

/** Disposable, source-local working storage; never part of the destination database. */
export async function createGtfsWorkingStore() {
  const directory = await mkdtemp(path.join(tmpdir(), 'node-gtfs-validation-'));
  let database: Database.Database;
  try {
    database = new Database(path.join(directory, 'records.sqlite'));
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    try {
      database.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
  try {
    // This database is discarded after success or failure. Bound its page cache
    // and keep sort spill on disk; recovery/durability belongs to the destination.
    database.exec(`
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      PRAGMA cache_size = -8192;
      PRAGMA temp_store = FILE;
      CREATE TABLE notices (phase INTEGER, sequence INTEGER PRIMARY KEY, payload BLOB);
      BEGIN;
    `);
    const records = createGtfsWorkingBatches(database, 'records');
    const referenceRows = createGtfsWorkingBatches<
      GtfsValidationSourceRecord['row'],
      GtfsValidationSourceRecord['position']
    >(database, 'reference_rows');
    const keyTracker = createGtfsValidationKeyStore(database);
    const referenceValues = createGtfsValidationReferenceStore(database);
    const insertNotice = database.prepare(
      'INSERT INTO notices (phase, payload) VALUES (?, ?)',
    );
    const readNotices = database
      .prepare('SELECT payload FROM notices ORDER BY phase, sequence')
      .pluck();
    const validation = createValidationSummary();
    let noticesConsumed = false;
    function* consumeNoticeBatches(
      onNotice?: (notice: GtfsValidationNotice) => void,
    ) {
      if (noticesConsumed) {
        return;
      }
      noticesConsumed = true;
      let count = 0;
      for (const payload of readNotices.iterate()) {
        const notice = deserialize(payload as Buffer) as GtfsValidationNotice;
        collectValidationNotice(validation, notice);
        onNotice?.(notice);
        if (++count % 512 === 0) {
          yield;
        }
      }
    }
    return {
      directory,
      close,
      createShapeRequirements() {
        return createGtfsShapeRequirements(database);
      },
      finish() {
        records.flush();
        referenceRows.flush();
        database.exec('COMMIT');
      },
      addNotices(
        phase: number | ((notice: GtfsValidationNotice) => number),
        notices: Iterable<GtfsValidationNotice>,
      ) {
        for (const notice of notices) {
          insertNotice.run(
            typeof phase === 'number' ? phase : phase(notice),
            serialize(notice),
          );
        }
      },
      consumeNotices(onNotice?: (notice: GtfsValidationNotice) => void) {
        for (const _batch of consumeNoticeBatches(onNotice)) {
          // Synchronous consumers retain the same ordered summary contract.
        }
        return freezeValidationSummary(validation);
      },
      consumeNoticeBatches,
      primaryKeys(filename: string) {
        return keyTracker(filename, 'primary');
      },
      addReferenceValue: referenceValues.add,
      hasReferenceValue: referenceValues.has,
      addReferenceRow: referenceRows.append,
      referenceRecords: referenceRows.records,
      recordWriter({
        table,
        keepFirst,
      }: {
        readonly table: FileBackedCompiledGtfsTable;
        readonly keepFirst: boolean;
      }) {
        const keyFields = keepFirst ? getStorageKeyColumnNames(table) : [];
        const storageKeys = keyTracker(table.filename, 'storage');
        return (ordinal: number, record: NormalizedImportRecord) => {
          records.assertNextOrdinal(table.filename, ordinal);
          if (keyFields.length > 0) {
            const firstPosition = storageKeys.register(
              encodeGtfsCanonicalKey(
                keyFields.map((field) => record.row[field] ?? null),
              ),
              record.position,
            );
            if (firstPosition !== undefined) {
              return { firstPosition };
            }
          }
          records.append(table.filename, ordinal, record);
          return undefined;
        };
      },
      *batches(
        table: FileBackedCompiledGtfsTable,
        batchSize: number,
        totalRecordCount: number,
      ): Generator<NormalizedImportRowBatch> {
        let batch: NormalizedImportRecord[] = [];
        for (const record of records.records(table.filename)) {
          Object.freeze(record.row);
          Object.freeze(record.position);
          batch.push(Object.freeze(record));
          if (batch.length >= batchSize) {
            const position = record.position;
            yield {
              table,
              records: batch,
              totalRecordCount:
                position.kind === 'csv'
                  ? position.recordNumber
                  : position.kind === 'geojson'
                    ? position.featureNumber
                    : position.entityNumber,
            };
            batch = [];
          }
        }
        if (batch.length > 0) {
          yield { table, records: batch, totalRecordCount };
        }
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export type GtfsWorkingStore = Awaited<
  ReturnType<typeof createGtfsWorkingStore>
>;
