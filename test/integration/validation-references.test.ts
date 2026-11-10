import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { GtfsValidationNoticeCode } from '../../src/diagnostics/errors.ts';
import { iterateGtfsReferenceNotices } from '../../src/validation/references.ts';

import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import type { ParsedGtfsSourceFile } from '../../src/validation/types.ts';
import { compileTable } from '../../src/schema/compile-table.ts';
import {
  defineGtfsTable,
  type GtfsFieldDefinition,
} from '../../src/schema/define-table.ts';
import {
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../src/schema/table-registry.ts';

function validateGtfsReferences(
  options: Parameters<typeof iterateGtfsReferenceNotices>[0],
) {
  return [...iterateGtfsReferenceNotices(options)];
}

function* singleLineCsvRecords(
  rows: Iterable<Readonly<Record<string, string>>>,
) {
  let recordNumber = 0;
  for (const row of rows) {
    recordNumber += 1;
    yield {
      row,
      position: {
        kind: 'csv' as const,
        recordNumber,
        csvLineNumber: recordNumber + 1,
      },
    };
  }
}

const serviceTargets = [
  {
    targetFilename: 'calendar.txt',
    targetField: 'service_id',
    relationship: 'advisory',
  },
  {
    targetFilename: 'calendar_dates.txt',
    targetField: 'service_id',
    relationship: 'advisory',
  },
];

for (const { table, contents } of [
  {
    table: compiledTableRegistry.trips,
    contents: 'route_id,service_id,trip_id\nroute,service,trip\n',
  },
  {
    table: compiledTableRegistry.timeframes,
    contents: 'timeframe_group_id,service_id\ntimeframe,service\n',
  },
  {
    table: compiledTableRegistry.deadheads,
    contents: 'deadhead_id,service_id,block_id\ndeadhead,service,block\n',
  },
]) {
  for (const { name, calendar, dates, missing } of [
    {
      name: 'calendar match only',
      calendar: 'service',
      dates: 'other',
      missing: false,
    },
    {
      name: 'calendar_dates match only',
      calendar: 'other',
      dates: 'service',
      missing: false,
    },
    {
      name: 'both match',
      calendar: 'service',
      dates: 'service',
      missing: false,
    },
    {
      name: 'neither matches',
      calendar: 'other',
      dates: 'other',
      missing: true,
    },
    {
      name: 'calendar_dates file absent',
      calendar: 'service',
      dates: undefined,
      missing: false,
    },
    {
      name: 'calendar file absent',
      calendar: undefined,
      dates: 'service',
      missing: false,
    },
    {
      name: 'missing ID with calendar_dates file absent',
      calendar: 'other',
      dates: undefined,
      missing: true,
    },
    {
      name: 'missing ID with calendar file absent',
      calendar: undefined,
      dates: 'other',
      missing: true,
    },
  ]) {
    test(`${table.filename}.service_id alternatives: ${name}`, async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-reference-'));
      try {
        await writeFile(path.join(directory, table.filename), contents);
        if (calendar !== undefined) {
          await writeFile(
            path.join(directory, 'calendar.txt'),
            `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n${calendar},1,1,1,1,1,1,1,20260101,20261231\n`,
          );
        }
        if (dates !== undefined) {
          await writeFile(
            path.join(directory, 'calendar_dates.txt'),
            `service_id,date,exception_type\n${dates},20260101,1\n`,
          );
        }
        for (const mode of ['strict', 'permissive', 'off'] as const) {
          const staged = await stageGtfsSource({
            directory,
            tables: [
              table,
              compiledTableRegistry.calendar,
              compiledTableRegistry.calendarDates,
            ],
            sourceId: 'reference-test',
            mode,
            onUnknownField: 'discard',
          });
          t.after(() => staged.close());
          const result = staged.validation;
          assert.equal(result.valid, true);
          assert.equal(result.shouldReject, false);
          assert.deepEqual(
            result.samples,
            missing && mode !== 'off'
              ? [
                  {
                    code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
                    severity: 'warn',
                    message: `${table.filename} CSV record 1 (ending at line 2) references missing calendar.txt.service_id or calendar_dates.txt.service_id`,
                    filename: table.filename,
                    position: {
                      kind: 'csv',
                      recordNumber: 1,
                      csvLineNumber: 2,
                    },
                    field: 'service_id',
                    sourceId: 'reference-test',
                    details: { value: 'service', targets: serviceTargets },
                  },
                ]
              : [],
            mode,
          );
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}

function referenceNotices(rows: readonly Readonly<Record<string, string>>[]) {
  const files: readonly [
    FileBackedCompiledGtfsTable,
    readonly Readonly<Record<string, string>>[],
  ][] = [
    [compiledTableRegistry.translations, rows],
    [compiledTableRegistry.stops, [{ stop_id: 'stop' }]],
    [compiledTableRegistry.routes, [{ route_id: 'route' }]],
    [
      compiledTableRegistry.stopTimes,
      [{ trip_id: 'trip', stop_sequence: '5' }],
    ],
    [
      compiledTableRegistry.calendarDates,
      [{ service_id: 'service', date: '20260101' }],
    ],
  ];
  return validateGtfsReferences({
    options: {
      directory: '',
      tables: files.map(([table]) => table),
      mode: 'strict',
      onUnknownField: 'discard',
    },
    tablesByFilename: new Map(files.map(([table]) => [table.filename, table])),
    parsedFiles: new Map<string, ParsedGtfsSourceFile>(
      files.map(([table, fileRows]) => [
        table.filename,
        {
          headers: [],
          records: { [Symbol.iterator]: () => singleLineCsvRecords(fileRows) },
        },
      ]),
    ),
  });
}

test('translations validate only targets whose row condition matches', () => {
  assert.deepEqual(
    referenceNotices([
      { table_name: 'stops', record_id: 'stop' },
      { table_name: 'routes', record_id: 'route' },
      { table_name: 'stop_times', record_sub_id: '5' },
      { table_name: 'calendar_dates', record_sub_id: '20260101' },
      {
        table_name: 'unrecognized_table',
        record_id: 'unknown',
        record_sub_id: 'unknown',
      },
      { table_name: 'stops', record_id: '' },
    ]),
    [],
  );

  const notices = referenceNotices([
    { table_name: 'stops', record_id: 'route' },
    { table_name: 'routes', record_id: 'stop' },
    { table_name: 'stop_times', record_sub_id: '20260101' },
    { table_name: 'calendar_dates', record_sub_id: '5' },
  ]);
  assert.deepEqual(
    notices.map(({ code, severity, filename, position, field, details }) => ({
      code,
      severity,
      filename,
      position,
      field,
      details,
    })),
    [
      {
        position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
        field: 'record_id',
        value: 'route',
        targetFilename: 'stops.txt',
        targetField: 'stop_id',
      },
      {
        position: { kind: 'csv', recordNumber: 2, csvLineNumber: 3 },
        field: 'record_id',
        value: 'stop',
        targetFilename: 'routes.txt',
        targetField: 'route_id',
      },
      {
        position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
        field: 'record_sub_id',
        value: '20260101',
        targetFilename: 'stop_times.txt',
        targetField: 'stop_sequence',
      },
      {
        position: { kind: 'csv', recordNumber: 4, csvLineNumber: 5 },
        field: 'record_sub_id',
        value: '5',
        targetFilename: 'calendar_dates.txt',
        targetField: 'date',
      },
    ].map(({ position, field, value, targetFilename, targetField }) => ({
      code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
      severity: 'warn',
      filename: 'translations.txt',
      position,
      field,
      details: {
        value,
        targetFilename,
        targetField,
        relationship: 'polymorphic',
      },
    })),
  );
});

function referenceTable(
  filename: string,
  fields: Readonly<Record<string, GtfsFieldDefinition>>,
): FileBackedCompiledGtfsTable {
  return {
    ...compileTable(
      defineGtfsTable({
        filename,
        tableName: filename.replace('.txt', ''),
        specification: 'gtfs-schedule',
        presence: 'optional',
        keyStrategy: 'columns',
        fields,
      }),
    ),
    filename,
  };
}

function validateReferenceFiles(
  files: readonly (readonly [
    FileBackedCompiledGtfsTable,
    Iterable<Readonly<Record<string, string>>>,
  ])[],
  mode: 'strict' | 'off' = 'strict',
) {
  return validateGtfsReferences({
    options: {
      directory: '',
      tables: files.map(([table]) => table),
      mode,
      onUnknownField: 'discard',
    },
    tablesByFilename: new Map(files.map(([table]) => [table.filename, table])),
    parsedFiles: new Map(
      files.map(([table, rows]) => [
        table.filename,
        {
          headers: [],
          records: { [Symbol.iterator]: () => singleLineCsvRecords(rows) },
        },
      ]),
    ),
  });
}

test('checks all reference fields in one streaming traversal with supplied target indexes', () => {
  const target = referenceTable('target.txt', { id: { kind: 'id' } });
  const reference = {
    targetFilename: 'target.txt',
    targetField: 'id',
    relationship: 'unambiguous' as const,
  };
  const source = referenceTable('source.txt', {
    first_id: { kind: 'id', references: [reference] },
    second_id: { kind: 'id', references: [reference] },
    empty_id: { kind: 'id', references: [reference] },
  });
  let traversals = 0;
  let recordsRead = 0;
  let lookups = 0;
  const notices = iterateGtfsReferenceNotices({
    options: {
      directory: '',
      tables: [source, target],
      mode: 'strict',
      onUnknownField: 'discard',
    },
    tablesByFilename: new Map([
      [source.filename, source],
      [target.filename, target],
    ]),
    parsedFiles: new Map([
      [
        source.filename,
        {
          headers: ['first_id', 'second_id', 'empty_id'],
          records: {
            *[Symbol.iterator]() {
              traversals += 1;
              assert.equal(traversals, 1, 'Source records must not be reread');
              for (let index = 0; index < 100; index += 1) {
                recordsRead += 1;
                yield {
                  row: {
                    first_id: `missing-${index}`,
                    second_id: 'match',
                    empty_id: '',
                  },
                  position: {
                    kind: 'csv' as const,
                    recordNumber: index + 1,
                    csvLineNumber: index + 2,
                  },
                };
              }
            },
          },
        },
      ],
      [
        target.filename,
        {
          headers: ['id'],
          records: {
            [Symbol.iterator]() {
              return assert.fail(
                'A file without source references must not be traversed',
              );
            },
          },
        },
      ],
    ]),
    targetIndex(filename, field) {
      assert.equal(filename, target.filename);
      assert.equal(field, 'id');
      return {
        has(value) {
          lookups += 1;
          return value === 'match';
        },
      };
    },
  });
  assert.equal(recordsRead, 0);
  const first = notices.next();
  assert.equal(first.done, false);
  assert.equal(recordsRead, 1, 'Yield notices without buffering source rows');
  assert.equal(first.value?.details?.value, 'missing-0');
  const remaining = [...notices];
  assert.equal(remaining.length, 99);
  assert.equal(remaining.at(-1)?.details?.value, 'missing-99');
  assert.equal(traversals, 1);
  assert.equal(recordsRead, 100);
  assert.equal(lookups, 200);
});

test('indexes each needed target column once and never reads unrelated columns', () => {
  const target = referenceTable('target.txt', {
    id: { kind: 'id' },
    large_text: { kind: 'text' },
  });
  const reference = {
    targetFilename: 'target.txt',
    targetField: 'id',
    relationship: 'unambiguous' as const,
  };
  const source = referenceTable('source.txt', {
    first_id: { kind: 'id', references: [reference] },
    second_id: { kind: 'id', references: [reference] },
  });
  let targetReads = 0;
  const targetRows = ['one', 'two', ''].map((id) => ({
    get id() {
      targetReads += 1;
      return id;
    },
    get large_text(): string {
      return assert.fail('An unreferenced column must not be indexed');
    },
  }));
  const sourceRows = Array.from({ length: 100 }, () => ({
    first_id: 'one',
    second_id: 'two',
  }));
  assert.deepEqual(
    validateReferenceFiles([
      [source, sourceRows],
      [target, targetRows],
    ]),
    [],
  );
  assert.equal(targetReads, 3);

  // Indexes belong to a validation call, not to a feed or module-level cache.
  assert.deepEqual(
    validateReferenceFiles([
      [source, [{ first_id: 'new' }]],
      [target, [{ id: 'new' }]],
    ]),
    [],
  );
});

test('does not index inapplicable, advisory-only, empty-value, or unused alternative targets', () => {
  const usedTarget = referenceTable('used.txt', { id: { kind: 'id' } });
  const unusedTarget = referenceTable('unused.txt', { id: { kind: 'id' } });
  const unusedReference = {
    targetFilename: 'unused.txt',
    targetField: 'id',
    relationship: 'unambiguous' as const,
  };
  const source = referenceTable('source.txt', {
    alternative: {
      kind: 'id',
      references: [
        {
          targetFilename: 'used.txt',
          targetField: 'id',
          relationship: 'unambiguous',
        },
        unusedReference,
      ],
    },
    conditional: {
      kind: 'id',
      references: [
        { ...unusedReference, when: { field: 'selector', equals: 'enabled' } },
      ],
    },
    advisory: {
      kind: 'id',
      references: [{ ...unusedReference, relationship: 'advisory' }],
    },
    empty: { kind: 'id', references: [unusedReference] },
    selector: { kind: 'text' },
  });
  const unreadableRows = [
    {
      get id(): string {
        return assert.fail('An unused reference target must not be indexed');
      },
    },
  ];
  assert.deepEqual(
    validateReferenceFiles([
      [
        source,
        [
          {
            alternative: 'match',
            conditional: 'missing',
            selector: 'disabled',
            advisory: 'missing',
            empty: '',
          },
        ],
      ],
      [usedTarget, [{ id: 'match' }]],
      [unusedTarget, unreadableRows],
    ]),
    [],
  );
  assert.deepEqual(
    validateReferenceFiles([
      [source, []],
      [unusedTarget, unreadableRows],
    ]),
    [],
  );
  assert.deepEqual(
    validateReferenceFiles(
      [
        [source, [{ conditional: 'missing', selector: 'enabled' }]],
        [unusedTarget, unreadableRows],
      ],
      'off',
    ),
    [],
  );
});

test('builds a conditional target index only when a row activates it', () => {
  const target = referenceTable('target.txt', { id: { kind: 'id' } });
  const source = referenceTable('source.txt', {
    selector: { kind: 'text' },
    id: {
      kind: 'id',
      references: [
        {
          targetFilename: 'target.txt',
          targetField: 'id',
          relationship: 'polymorphic',
          when: { field: 'selector', in: ['enabled'] },
        },
      ],
    },
  });
  let reads = 0;
  const rows = [
    { selector: 'disabled', id: 'missing' },
    { selector: 'enabled', id: 'match' },
    { selector: 'enabled', id: 'missing' },
  ];
  const notices = validateReferenceFiles([
    [source, rows],
    [
      target,
      [
        {
          get id() {
            reads += 1;
            return 'match';
          },
        },
      ],
    ],
  ]);
  assert.equal(reads, 1);
  assert.deepEqual(notices, [
    {
      code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
      severity: 'warn',
      filename: 'source.txt',
      position: { kind: 'csv', recordNumber: 3, csvLineNumber: 4 },
      field: 'id',
      message:
        'source.txt CSV record 3 (ending at line 4) references missing target.txt.id',
      details: {
        value: 'missing',
        targetFilename: 'target.txt',
        targetField: 'id',
        relationship: 'polymorphic',
      },
    },
  ]);
});

test('distinguishes unavailable targets from available empty target indexes', () => {
  const target = referenceTable('target.txt', { id: { kind: 'id' } });
  const source = referenceTable('source.txt', {
    id: {
      kind: 'id',
      references: [
        {
          targetFilename: 'target.txt',
          targetField: 'id',
          relationship: 'unambiguous',
        },
      ],
    },
  });
  assert.deepEqual(validateReferenceFiles([[source, [{ id: 'missing' }]]]), []);
  const notices = validateReferenceFiles([
    [source, [{ id: 'missing' }]],
    [target, []],
  ]);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.severity, 'error');
  assert.equal(notices[0]?.code, GtfsValidationNoticeCode.REFERENCE_NOT_FOUND);

  const undeclared = referenceTable('target.txt', { other: { kind: 'id' } });
  assert.deepEqual(
    validateReferenceFiles([
      [source, [{ id: 'missing' }]],
      [
        undeclared,
        [
          {
            get id(): string {
              return assert.fail(
                'Undeclared columns are not reference targets',
              );
            },
          },
        ],
      ],
    ]),
    [],
  );
});
