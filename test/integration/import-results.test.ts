import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { importGtfs } from '../../src/operations.ts';
import {
  GtfsErrorCode,
  GtfsValidationNoticeCode,
} from '../../src/diagnostics/errors.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { verifyImportResultCounts } from '../contracts/cases/import-result.ts';

const filesOtherThanStops = Object.values(compiledTableRegistry).flatMap(
  ({ filename }) =>
    filename === null || filename === 'stops.txt' ? [] : [filename],
);

async function directory(t: TestContext) {
  const result = await mkdtemp(path.join(tmpdir(), 'gtfs-import-outcome-'));
  t.after(() => rm(result, { recursive: true, force: true }));
  return result;
}

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter}: reports committed counts for CSV, GeoJSON, skipped rows, and empty files`, async () => {
    const sqlite = new Database(':memory:');
    const client =
      adapter === 'native'
        ? sqlite
        : new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    try {
      await verifyImportResultCounts({ client });
    } finally {
      if (client instanceof Kysely) {
        await client.destroy();
      } else {
        client.close();
      }
    }
  });

  test(`${adapter}: rolled-back source writes report zero inserts and later sources still succeed`, async (t) => {
    const first = await directory(t);
    const replacement = await directory(t);
    const sqlite = new Database(':memory:');
    const client =
      adapter === 'native'
        ? sqlite
        : new Kysely({ dialect: new SqliteDialect({ database: sqlite }) });
    t.after(async () => {
      if (client instanceof Kysely) {
        await client.destroy();
      } else {
        client.close();
      }
    });
    const database = { client };
    await writeFile(
      path.join(first, 'stops.txt'),
      'stop_id,stop_name\nold,Original\n',
    );
    const initial = await importGtfs({
      database,
      sources: [{ sourceId: 'replace', schedule: { path: first } }],
      reporting: { level: 'silent' },
    });
    assert.deepEqual(initial.sources[0]?.files, [
      {
        filename: 'stops.txt',
        recordsRead: 1,
        rowsInserted: 1,
        rowsSkipped: 0,
      },
    ]);
    await writeFile(
      path.join(replacement, 'agency.txt'),
      'agency_name,agency_url,agency_timezone\nChanged,https://example.com,Etc/UTC\n',
    );
    await writeFile(
      path.join(replacement, 'stops.txt'),
      'stop_id,stop_name\nnew,Changed\nbad,Refuse\n',
    );
    sqlite.exec(
      "CREATE TRIGGER refuse_stop BEFORE INSERT ON stops WHEN NEW.stop_name = 'Refuse' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    const result = await importGtfs({
      database,
      sources: [
        {
          sourceId: 'replace',
          schedule: {
            path: replacement,
            import: { onSourceError: 'continue' },
          },
        },
        { sourceId: 'next', schedule: { path: first } },
      ],
      reporting: { level: 'silent' },
    });
    assert.equal(result.success, false);
    assert.deepEqual(
      result.sources.map(({ sourceId, success }) => ({ sourceId, success })),
      [
        { sourceId: 'replace', success: false },
        { sourceId: 'next', success: true },
      ],
    );
    assert.equal(result.sources[0]?.error, result.errors[0]);
    assert.equal(
      result.sources[0]?.error?.code,
      GtfsErrorCode.DATABASE_OPERATION_FAILED,
    );
    assert.deepEqual(
      Object.fromEntries(
        result.sources[0]?.files.map(({ filename, ...counts }) => [
          filename,
          counts,
        ]) ?? [],
      ),
      {
        'agency.txt': { recordsRead: 1, rowsInserted: 0, rowsSkipped: 0 },
        'stops.txt': { recordsRead: 2, rowsInserted: 0, rowsSkipped: 0 },
      },
    );
    assert.equal(result.sources[1]?.files[0]?.rowsInserted, 1);
    assert.deepEqual(
      sqlite
        .prepare("SELECT stop_name FROM stops WHERE source_id = 'replace'")
        .all(),
      [{ stop_name: 'Original' }],
    );
  });
}

test('preparation failures are represented in source order with automatic extensions', async (t) => {
  const feed = await directory(t);
  await writeFile(path.join(feed, 'stops.txt'), 'stop_id\nstop\n');
  const client = new Database(':memory:');
  t.after(() => client.close());
  const result = await importGtfs({
    database: { client },
    extensions: 'auto',
    sources: [
      {
        sourceId: 'missing',
        schedule: {
          path: path.join(feed, 'absent'),
          import: { onSourceError: 'continue' },
        },
      },
      { sourceId: 'present', schedule: { path: feed } },
    ],
    reporting: { level: 'silent' },
  });
  assert.deepEqual(
    result.sources.map(({ sourceId, success }) => ({ sourceId, success })),
    [
      { sourceId: 'missing', success: false },
      { sourceId: 'present', success: true },
    ],
  );
  assert.deepEqual(result.sources[0]?.files, []);
  assert.ok(result.sources[0]?.error);
  assert.equal(result.sources[1]?.files[0]?.rowsInserted, 1);
});

test('strict validation rejects errors beyond the sample limit', async (t) => {
  const feed = await directory(t);
  const extraFields = Array.from(
    { length: 110 },
    (_, index) => `extra_${index}`,
  );
  await writeFile(
    path.join(feed, 'stops.txt'),
    [
      ['stop_id', 'stop_lat', ...extraFields].join(','),
      ['stop', 'invalid', ...extraFields.map(() => 'value')].join(','),
      '',
    ].join('\n'),
  );
  let delivered = 0;
  const staged = await stageGtfsSource({
    directory: feed,
    sourceId: 'late-error',
    tables: [compiledTableRegistry.stops],
    mode: 'strict',
    onUnknownField: 'preserve',
    excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
    onNotice() {
      delivered += 1;
    },
  });
  t.after(() => staged.close());
  assert.equal(staged.validation.shouldReject, true);
  assert.equal(staged.validation.valid, false);
  assert.equal(staged.validation.samples.length, 100);
  assert.equal(staged.validation.truncated, true);
  assert.equal(
    staged.validation.samples.every(({ severity }) => severity === 'warn'),
    true,
  );
  assert.equal(
    staged.validation.countsByCode[GtfsValidationNoticeCode.UNKNOWN_FIELD],
    110,
  );
  assert.ok(staged.validation.countsBySeverity.error > 0);
  assert.equal(
    delivered,
    Object.values(staged.validation.countsByCode).reduce(
      (sum, count) => sum + count,
      0,
    ),
  );
  const client = new Database(':memory:');
  t.after(() => client.close());
  const result = await importGtfs({
    database: { client },
    sources: [
      {
        sourceId: 'late-error',
        schedule: {
          path: feed,
          excludeFiles: filesOtherThanStops,
          import: {
            onSourceError: 'continue',
            validation: { mode: 'strict' },
          },
        },
      },
    ],
    reporting: { level: 'silent' },
  });
  assert.equal(result.success, false);
  assert.equal(result.sources[0]?.success, false);
  assert.equal(result.errors[0]?.code, GtfsErrorCode.VALIDATION_FAILED);
  assert.deepEqual(result.errors[0]?.details?.validation, result.validation);
  assert.deepEqual(
    result.validation.countsByCode,
    staged.validation.countsByCode,
  );
  assert.equal(result.validation.samples.length, 100);
  assert.equal(result.validation.truncated, true);
  assert.deepEqual(result.sources[0]?.files, [
    { filename: 'stops.txt', recordsRead: 1, rowsInserted: 0, rowsSkipped: 1 },
  ]);
});

test('retains bounded diagnostics and delivers notices when CSV parsing fails', async (t) => {
  const feed = await directory(t);
  const fields = Array.from({ length: 130 }, (_, index) => `custom_${index}`);
  await writeFile(
    path.join(feed, 'stops.txt'),
    ['stop_id', ...fields].join(',') + '\n"unfinished',
  );
  const client = new Database(':memory:');
  t.after(() => client.close());
  let delivered = 0;
  const result = await importGtfs({
    database: { client },
    sources: [
      {
        schedule: {
          path: feed,
          excludeFiles: filesOtherThanStops,
          import: {
            onSourceError: 'continue',
            validation: { mode: 'permissive' },
          },
        },
      },
    ],
    reporting: {
      level: 'info',
      reporter(event) {
        if (event.type === 'validation:notice') {
          delivered += 1;
        }
      },
    },
  });
  assert.equal(result.success, false);
  assert.equal(result.errors[0]?.code, GtfsErrorCode.CSV_PARSE_FAILED);
  assert.equal(result.validation.samples.length, 100);
  assert.equal(result.validation.truncated, true);
  assert.equal(
    result.validation.countsByCode[GtfsValidationNoticeCode.UNKNOWN_FIELD],
    130,
  );
  assert.equal(delivered, 130);
  assert.deepEqual(result.sources[0]?.files, [
    { filename: 'stops.txt', recordsRead: 0, rowsInserted: 0, rowsSkipped: 0 },
  ]);
});

test('collects bounded operation samples across sources but reports every notice', async (t) => {
  const feed = await directory(t);
  await writeFile(
    path.join(feed, 'stops.txt'),
    'stop_id,parent_station\n' +
      Array.from({ length: 180 }, (_, index) => `s${index},missing\n`).join(''),
  );
  const client = new Database(':memory:');
  t.after(() => client.close());
  let delivered = 0;
  const result = await importGtfs({
    database: { client },
    sources: ['first', 'second'].map((sourceId) => ({
      sourceId,
      schedule: {
        path: feed,
        import: { validation: { mode: 'permissive' as const } },
      },
    })),
    reporting: {
      level: 'info',
      reporter(event) {
        if (event.type === 'validation:notice') {
          delivered += 1;
        }
      },
    },
  });
  assert.equal(result.success, true);
  assert.equal(result.validation.samples.length, 100);
  assert.equal(result.validation.truncated, true);
  assert.equal(
    result.validation.countsByCode[
      GtfsValidationNoticeCode.REFERENCE_NOT_FOUND
    ],
    360,
  );
  assert.equal(
    delivered,
    Object.values(result.validation.countsByCode).reduce(
      (sum, count) => sum + count,
      0,
    ),
  );
  assert.deepEqual(
    result.sources.map(({ files }) => files[0]?.rowsInserted),
    [180, 180],
  );
});
