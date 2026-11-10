import {
  cancellationCheckpoint,
  getOperationSignal,
} from '../../cancellation.ts';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FileBackedCompiledGtfsTable } from '../../schema/table-registry.ts';
import type { GtfsShapeRequirements } from '../../validation/shapes.ts';
import { GtfsValidationNoticeCode } from '../../diagnostics/errors.ts';
import { iterateGtfsReferenceNotices } from '../../validation/references.ts';
import { createValidationNotice } from '../../validation/notice.ts';
import {
  createGtfsWorkingStore,
  type GtfsWorkingStore,
} from './staging/store.ts';
import {
  scanGtfsSourceFile,
  type GtfsNormalizedBatchSink,
  type GtfsSourceProcessing,
  type GtfsImportSourceOptions,
  type GtfsDirectImportSourceOptions,
} from './scan.ts';
import type {
  GtfsSourceValidationResult,
  ParsedGtfsSourceFile,
} from '../../validation/types.ts';

function planGtfsReferenceFields(
  tables: readonly FileBackedCompiledGtfsTable[],
) {
  const sourceFields = new Map<string, Set<string>>();
  const targetFields = new Map<string, Set<string>>();
  for (const table of tables) {
    const fields = new Set<string>();
    sourceFields.set(table.filename, fields);
    for (const column of table.columns) {
      for (const reference of column.references ?? []) {
        if (
          reference.when === undefined &&
          reference.relationship === 'advisory'
        ) {
          continue;
        }
        fields.add(column.name);
        if (reference.when !== undefined) {
          fields.add(reference.when.field);
        }
        const targets =
          targetFields.get(reference.targetFilename) ?? new Set<string>();
        targets.add(reference.targetField);
        targetFields.set(reference.targetFilename, targets);
      }
    }
  }
  return { sourceFields, targetFields };
}

async function* validationChunks<Row>(
  records: Iterable<Row>,
): AsyncGenerator<Iterable<Row>> {
  if (getOperationSignal() === undefined) {
    yield records;
    return;
  }
  let batch: Row[] = [];
  for (const row of records) {
    batch.push(row);
    if (batch.length === 512) {
      await cancellationCheckpoint();
      yield batch;
      batch = [];
    }
  }
  await cancellationCheckpoint();
  yield batch;
}

async function validateGtfsCrossFileRules({
  options,
  store,
  parsedFiles,
  targetFields,
  shapeRequirements,
}: {
  readonly options: GtfsImportSourceOptions;
  readonly store: GtfsWorkingStore;
  readonly parsedFiles: ReadonlyMap<string, ParsedGtfsSourceFile>;
  readonly targetFields: ReadonlyMap<string, ReadonlySet<string>>;
  readonly shapeRequirements: GtfsShapeRequirements | undefined;
}): Promise<void> {
  const tablesByFilename = new Map(
    options.tables.map((table) => [table.filename, table]),
  );
  const finalPhase = options.tables.length * 4;
  if (
    options.mode !== 'off' &&
    !parsedFiles.has('calendar.txt') &&
    !parsedFiles.has('calendar_dates.txt') &&
    !(
      options.excludeFiles?.includes('calendar.txt') &&
      options.excludeFiles?.includes('calendar_dates.txt')
    )
  ) {
    store.addNotices(finalPhase, [
      createValidationNotice(options, {
        code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
        severity: 'error',
        message:
          'At least one of calendar.txt or calendar_dates.txt is required',
        filename: 'calendar.txt',
        details: { alternatives: ['calendar.txt', 'calendar_dates.txt'] },
      }),
    ]);
  }
  if (options.mode !== 'off') {
    // Restore manifest ordering for reference notices after the agency-first scan.
    options.onProgress?.({ stage: 'references', phase: 'start' });
    await cancellationCheckpoint();
    if (shapeRequirements !== undefined) {
      const state = { reportedMissingFile: false };
      for await (const trips of validationChunks(
        store.referenceRecords('trips.txt'),
      )) {
        store.addNotices(
          finalPhase,
          shapeRequirements.notices({
            options,
            trips,
            shapesPresent: parsedFiles.has('shapes.txt'),
            state,
          }),
        );
      }
    }
    const orderedFiles = new Map(
      options.tables.flatMap((table) => {
        const source = parsedFiles.get(table.filename);
        return source === undefined ? [] : [[table.filename, source] as const];
      }),
    );
    const targetIndexes = new Map<
      string,
      Map<string, { has(value: string): boolean }>
    >();
    for (const [filename, fields] of targetFields) {
      const table = tablesByFilename.get(filename);
      if (table === undefined || !parsedFiles.has(filename)) {
        continue;
      }
      const indexes = new Map<string, { has(value: string): boolean }>();
      for (const field of fields) {
        if (table.columns.some(({ name }) => name === field)) {
          indexes.set(field, {
            has: (value) => store.hasReferenceValue(filename, field, value),
          });
        }
      }
      targetIndexes.set(filename, indexes);
    }
    // Check references row-wise, but order notices by manifest file/field and then
    // record. The working database performs the ordering without buffering rows.
    const referenceNoticePhases = new Map<string, number>();
    let referencePhase = finalPhase + 1;
    for (const table of options.tables) {
      for (const column of table.columns) {
        referenceNoticePhases.set(
          `${table.filename}\0${column.name}`,
          referencePhase,
        );
        referencePhase += 1;
      }
    }
    for (const [filename, source] of orderedFiles) {
      for await (const records of validationChunks(source.records)) {
        store.addNotices(
          (notice) => {
            const phase = referenceNoticePhases.get(
              `${notice.filename}\0${notice.field}`,
            );
            if (phase === undefined) {
              throw new Error(
                `No reference notice ordering found for ${notice.filename}.${notice.field}`,
              );
            }
            return phase;
          },
          iterateGtfsReferenceNotices({
            options,
            parsedFiles: new Map([[filename, { ...source, records }]]),
            tablesByFilename,
            targetIndex(filename, field) {
              return targetIndexes.get(filename)?.get(field);
            },
            referenceSeverity({ filename, field, row }) {
              return filename === 'trips.txt' &&
                field === 'shape_id' &&
                shapeRequirements?.requiresShape(row)
                ? 'error'
                : undefined;
            },
          }),
        );
      }
    }
    await cancellationCheckpoint();
    options.onProgress?.({ stage: 'references', phase: 'complete' });
  }
}

async function scanGtfsSource({
  processing,
  store,
}: {
  readonly processing: GtfsSourceProcessing;
  readonly store: GtfsWorkingStore;
}) {
  const { options } = processing;
  const files = new Map<
    string,
    Awaited<ReturnType<typeof scanGtfsSourceFile>>
  >();
  const parsedFiles = new Map<string, ParsedGtfsSourceFile>();
  let defaultAgencyId = options.defaultAgencyId;
  const tables = options.tables.flatMap((table, index) =>
    options.excludeFiles?.includes(table.filename)
      ? []
      : [
          {
            table,
            phase: index * 4,
            present: existsSync(path.join(options.directory, table.filename)),
          },
        ],
  );
  // Absent or excluded consumers must not request indexes of large target files.
  const referencePlan = planGtfsReferenceFields(
    options.mode === 'off'
      ? []
      : tables.filter(({ present }) => present).map(({ table }) => table),
  );
  const shapeRequirements =
    options.mode !== 'off' &&
    ['routes.txt', 'trips.txt', 'stop_times.txt', 'shapes.txt'].every(
      (filename) => tables.some(({ table }) => table.filename === filename),
    )
      ? store.createShapeRequirements()
      : undefined;
  if (shapeRequirements !== undefined) {
    referencePlan.sourceFields.get('trips.txt')?.add('trip_id');
  }
  // Resolve a single agency's ID before normalizing other files, without rereading agency.txt.
  tables.sort(
    (left, right) =>
      Number(right.table.filename === 'agency.txt') -
      Number(left.table.filename === 'agency.txt'),
  );
  for (const { table, phase, present } of tables) {
    await cancellationCheckpoint();
    if (!present) {
      if (options.mode !== 'off' && table.presence === 'required') {
        store.addNotices(phase, [
          createValidationNotice(options, {
            code: GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
            severity: 'error',
            message: `Required GTFS file ${table.filename} is missing`,
            filename: table.filename,
          }),
        ]);
      }
      continue;
    }
    const result = await scanGtfsSourceFile({
      processing,
      table,
      store,
      phase,
      ...(shapeRequirements === undefined ? {} : { shapeRequirements }),
      sourceFields: [...(referencePlan.sourceFields.get(table.filename) ?? [])],
      targetFields: [
        ...(referencePlan.targetFields.get(table.filename) ?? []),
      ].filter((field) => table.columns.some(({ name }) => name === field)),
      ...(defaultAgencyId === undefined ? {} : { defaultAgencyId }),
    });
    files.set(table.filename, result);
    parsedFiles.set(table.filename, {
      headers: result.headers,
      records: {
        [Symbol.iterator]: () => store.referenceRecords(table.filename),
      },
    });
    if (
      table.filename === 'agency.txt' &&
      defaultAgencyId !== undefined &&
      result.agencyId !== undefined
    ) {
      defaultAgencyId = result.agencyId;
    }
  }
  await validateGtfsCrossFileRules({
    options,
    store,
    parsedFiles,
    targetFields: referencePlan.targetFields,
    shapeRequirements,
  });
  store.finish();
  if (getOperationSignal() !== undefined) {
    for (const _batch of store.consumeNoticeBatches(options.onNotice)) {
      await cancellationCheckpoint();
    }
  }
  const summary = store.consumeNotices(options.onNotice);
  await cancellationCheckpoint();
  const valid = summary.countsBySeverity.error === 0;
  const validation: GtfsSourceValidationResult = Object.freeze({
    ...summary,
    valid,
    shouldReject:
      (options.mode === 'strict' || options.mode === 'off') && !valid,
  });
  return { files, validation, defaultAgencyId };
}

export async function stageGtfsSource(options: GtfsImportSourceOptions) {
  const store = await createGtfsWorkingStore();
  try {
    const result = await scanGtfsSource({
      processing: { mode: 'stage', options },
      store,
    });
    return {
      ...result,
      directory: store.directory,
      close: store.close,
      batches: store.batches,
      assertNormalized() {
        for (const table of options.tables) {
          const error = result.files.get(table.filename)?.normalizationError;
          if (error !== undefined) {
            throw error;
          }
        }
      },
    };
  } catch (error) {
    try {
      if (!getOperationSignal()?.aborted) {
        store.consumeNotices(options.onNotice);
      }
    } finally {
      await store.close();
    }
    throw error;
  }
}

export type StagedGtfsSource = Awaited<ReturnType<typeof stageGtfsSource>>;

export async function importGtfsSourceDirectly({
  options,
  sink,
}: {
  readonly options: GtfsDirectImportSourceOptions;
  readonly sink: GtfsNormalizedBatchSink;
}) {
  const store = await createGtfsWorkingStore();
  try {
    return await scanGtfsSource({
      processing: { mode: 'direct', options, sink },
      store,
    });
  } finally {
    try {
      if (!getOperationSignal()?.aborted) {
        store.consumeNotices(options.onNotice);
      }
    } finally {
      await store.close();
    }
  }
}
