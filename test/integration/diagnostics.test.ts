import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { configIssueDetails } from '../helpers/config-issues.ts';
import {
  Gtfs,
  GtfsValidationNoticeCode,
  isGtfsError,
  type GtfsConfigIssue,
  type GtfsReportEvent,
  type GtfsSourcePosition,
  type GtfsValidationNotice,
} from '../../src/index.ts';
test('configuration errors expose typed issue paths through the public API', () => {
  assert.throws(
    () =>
      new Gtfs({
        database: {},
        reporting: { level: 'debug' },
      } as never),
    (error: unknown) => {
      assert.ok(isGtfsError(error));
      assert.equal(error.code, 'GTFS_CONFIG_INVALID');
      const issues: readonly GtfsConfigIssue[] | undefined =
        error.details?.errors;
      assert.ok(issues);
      assert.deepEqual(configIssueDetails(issues), [
        {
          reason: 'invalid-value',
          path: 'reporting.level',
        },
      ]);
      return true;
    },
  );
});
for (const mode of ['strict', 'permissive'] as const) {
  test(`${mode} validation preserves multiline CSV positions across invalid rows, duplicates, and reference checks`, async (t) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-notice-positions-'),
    );
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(
      path.join(directory, 'stops.txt'),
      [
        'stop_id,stop_name,parent_station,stop_lat,stop_lon',
        's,"First',
        'Stop",missing,0,0',
        '',
        'bad,Invalid,missing,not-a-number,0',
        's,Duplicate,missing,0,0',
      ].join('\r\n'),
    );
    const events: GtfsReportEvent[] = [];
    const gtfs = new Gtfs({
      database: {},
      sources: [
        {
          schedule: {
            path: directory,
            import: { validation: { mode, onDuplicateKey: 'keep-first' } },
          },
        },
      ],
      reporting: { reporter: (event) => events.push(event) },
    });
    t.after(() => gtfs.close());
    let notices: readonly GtfsValidationNotice[] = [];
    if (mode === 'strict') {
      await assert.rejects(
        async () => gtfs.import(),
        (error: unknown) => {
          assert.ok(isGtfsError(error));
          assert.equal(error.code, 'GTFS_VALIDATION_FAILED');
          notices = error.details?.validation?.samples ?? [];
          assert.equal(Object.hasOwn(error, 'position'), false);
          return true;
        },
      );
    } else {
      const result = await gtfs.import();
      notices = result.validation.samples;
      assert.deepEqual(
        (await gtfs.schedule.stops.all()).map(({ stop_id }) => stop_id),
        ['s'],
      );
    }
    const expected = [
      { kind: 'csv', recordNumber: 1, csvLineNumber: 3 },
      { kind: 'csv', recordNumber: 2, csvLineNumber: 5 },
      { kind: 'csv', recordNumber: 3, csvLineNumber: 6 },
    ];
    const references = notices.filter(
      ({ code }) => code === GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
    );
    assert.deepEqual(
      references.map(({ position }) => position),
      expected,
    );
    assert.ok(references.every((notice) => notice.message.length > 0));
    const duplicate = notices.find(
      ({ code }) => code === GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
    );
    assert.ok(duplicate);
    assert.deepEqual(duplicate.position, expected[2]);
    assert.deepEqual(duplicate.firstPosition, expected[0]);
    const invalid = notices.find(
      ({ code, field }) =>
        code === GtfsValidationNoticeCode.INVALID_VALUE && field === 'stop_lat',
    );
    assert.deepEqual(invalid?.position, expected[1]);
    const reported = events.filter(
      (event) => event.type === 'validation:notice',
    );
    assert.equal(reported.length, notices.length);
    for (const event of reported) {
      assert.deepEqual(event.position, event.notice.position);
      assert.deepEqual(event.firstPosition, event.notice.firstPosition);
    }
  });
}
for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter} write failures preserve typed positions in import results and reporter errors`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-diagnostics-'));
    const native = new Database(':memory:');
    const client =
      adapter === 'native'
        ? native
        : new Kysely({ dialect: new SqliteDialect({ database: native }) });
    const events: GtfsReportEvent[] = [];
    const gtfs = new Gtfs({
      database: { client },
      sources: [
        {
          sourceId: 'diagnostics',
          schedule: {
            path: directory,
            import: {
              onSourceError: 'continue',
              validation: { mode: 'permissive' },
            },
          },
        },
      ],
      reporting: { reporter: (event) => events.push(event) },
    });
    try {
      await writeFile(
        path.join(directory, 'agency.txt'),
        [
          'agency_id,agency_name,agency_url,agency_timezone',
          'first,"First',
          'Agency",https://example.test,America/Los_Angeles',
          '',
          'fail,Fail,https://example.test,America/Los_Angeles',
        ].join('\n'),
      );
      await gtfs.schema.ensure();
      native.exec(
        "CREATE TRIGGER reject_agency BEFORE INSERT ON agency WHEN NEW.agency_id = 'fail' BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
      );
      const result = await gtfs.import();
      assert.equal(result.success, false);
      assert.equal(result.errors.length, 1);
      const error = result.errors[0];
      assert.ok(error);
      assert.equal(error.code, 'GTFS_DATABASE_OPERATION_FAILED');
      const expected: readonly GtfsSourcePosition[] = [
        { kind: 'csv', recordNumber: 1, csvLineNumber: 3 },
        { kind: 'csv', recordNumber: 2, csvLineNumber: 5 },
      ];
      if (adapter === 'native') {
        assert.deepEqual(error.position, expected[1]);
        assert.equal(error.positions, undefined);
      } else {
        assert.deepEqual(error.positions, expected);
        assert.equal(error.position, undefined);
      }
      const reported = events.find(
        (event) => event.type === 'message' && event.error?.code === error.code,
      );
      assert.ok(reported?.type === 'message');
      assert.deepEqual(reported.error?.details, error.details);
      assert.deepEqual(reported.position, error.position);
      assert.deepEqual(reported.positions, error.positions);
      assert.deepEqual(reported.error?.position, error.position);
      assert.deepEqual(reported.error?.positions, error.positions);
      if (error.positions !== undefined) {
        assert.ok(Object.isFrozen(error.positions));
        assert.ok(error.positions.every(Object.isFrozen));
        assert.ok(Object.isFrozen(reported.positions));
      } else {
        assert.ok(Object.isFrozen(error.position));
      }
      const positions = reported.error?.positions;
      if (positions !== undefined) {
        assert.deepEqual(
          positions.map((position) =>
            position.kind === 'csv'
              ? position.csvLineNumber
              : position.kind === 'geojson'
                ? position.featureNumber
                : position.entityNumber,
          ),
          [3, 5],
        );
      } else {
        const position = reported.error?.position;
        assert.equal(
          position?.kind === 'csv' ? position.csvLineNumber : undefined,
          5,
        );
      }
    } finally {
      await gtfs.close();
      if (client instanceof Kysely) {
        await client.destroy();
      } else {
        client.close();
      }
      await rm(directory, { recursive: true, force: true });
    }
  });
}
