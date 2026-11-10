import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compileTable } from '../../src/schema/compile-table.ts';
import { defineGtfsTable } from '../../src/schema/define-table.ts';
import { scanGtfsSourceFile } from '../../src/schedule/import/scan.ts';
import { createGtfsWorkingStore } from '../../src/schedule/import/staging/store.ts';
import { validateGtfsPrimitiveRows } from '../../src/validation/rows.ts';
import { validateGtfsHeaders } from '../../src/validation/headers.ts';
import type { GtfsValidationMode } from '../../src/validation/types.ts';

for (const mode of ['strict', 'permissive'] satisfies GtfsValidationMode[]) {
  test(`${mode} plans present primitive columns once and retains missing required-value notices`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-row-plan-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const definition = defineGtfsTable({
      filename: 'values.txt',
      tableName: 'values',
      specification: 'gtfs-schedule',
      presence: 'optional',
      keyStrategy: 'none',
      storageKey: null,
      fields: {
        required: { kind: 'text', presence: 'required' },
        present: { kind: 'integer', minimum: 0, maximum: 10 },
        absent: { kind: 'time' },
      },
    });
    const compiled = compileTable(definition);
    let absentReads = 0;
    const table = {
      ...compiled,
      filename: 'values.txt',
      columns: compiled.columns.map((column) =>
        column.name === 'absent'
          ? {
              ...column,
              get name() {
                absentReads += 1;
                return 'absent';
              },
            }
          : column,
      ),
    };
    const options = {
      sourceId: 'test',
      directory,
      tables: [table],
      mode,
      onUnknownField: 'discard' as const,
    };
    const headers = ['present'];
    const input = ['1', 'invalid', '99'];
    const counts: number[] = [];
    for (const repetitions of [1, 50]) {
      const values = Array.from({ length: repetitions }, () => input).flat();
      await writeFile(
        path.join(directory, table.filename),
        `present\n${values.join('\n')}\n`,
      );
      const store = await createGtfsWorkingStore();
      try {
        absentReads = 0;
        await scanGtfsSourceFile({
          processing: { mode: 'stage', options },
          // Include normalization-plan setup in both scans.
          table: { ...table },
          store,
          phase: 0,
          sourceFields: [],
          targetFields: [],
        });
        counts.push(absentReads);
        const source = {
          headers,
          records: values.map((present, index) => ({
            row: { present },
            position: {
              kind: 'csv' as const,
              recordNumber: index + 1,
              csvLineNumber: index + 2,
            },
          })),
        };
        const notices: unknown[] = [];
        store.consumeNotices((notice) => notices.push(notice));
        assert.deepEqual(notices, [
          ...validateGtfsHeaders({ options, table, source }),
          ...validateGtfsPrimitiveRows({ options, table, source }),
        ]);
      } finally {
        await store.close();
      }
    }
    assert.deepEqual(counts, [counts[0], counts[0]]);
    assert.ok((counts[0] ?? 0) > 0);
  });
}
