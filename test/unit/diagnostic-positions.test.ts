import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GtfsError,
  formatGtfsError,
  toGtfsError,
} from '../../src/diagnostics/errors.ts';
import { log, validationNotice } from '../../src/reporting/report.ts';
import type { GtfsReportEvent } from '../../src/reporting/events.ts';
import {
  formatGtfsSourcePosition,
  type GtfsSourcePosition,
} from '../../src/diagnostics/position.ts';

const csv = { kind: 'csv', recordNumber: 2, csvLineNumber: 5 } as const;
const geojson = { kind: 'geojson', featureNumber: 3 } as const;
const realtime = { kind: 'realtime', entityNumber: 4 } as const;

test('error enrichment preserves precise positions and adds batch context only when absent', () => {
  const fallback = {
    code: 'GTFS_DATABASE_OPERATION_FAILED',
    message: 'Unable to store batch',
    positions: [csv, geojson],
    details: { filename: 'stops.txt' },
  } as const;
  const precise = new GtfsError('Invalid record', {
    code: 'GTFS_INVALID_VALUE',
    position: csv,
  });
  assert.equal(toGtfsError(precise, fallback), precise);
  assert.deepEqual(precise.position, csv);
  assert.equal(Object.hasOwn(precise, 'positions'), false);
  assert.deepEqual(precise.details, { filename: 'stops.txt' });

  const batch = new GtfsError('Insert failed', {
    code: 'GTFS_DATABASE_OPERATION_FAILED',
  });
  assert.equal(toGtfsError(batch, fallback), batch);
  assert.deepEqual(batch.positions, [csv, geojson]);
  assert.equal(Object.hasOwn(batch, 'position'), false);
  assert.ok(Object.isFrozen(batch.positions));
  assert.ok(batch.positions?.every(Object.isFrozen));
  const enriched = toGtfsError(batch, { ...fallback, position: realtime });
  assert.deepEqual(enriched.positions, [csv, geojson]);
  assert.equal(Object.hasOwn(enriched, 'position'), false);

  const cause = new Error('Driver failed');
  const wrapped = toGtfsError(cause, fallback);
  assert.equal(wrapped.cause, cause);
  assert.deepEqual(wrapped.positions, fallback.positions);
});

test('file-level errors and notices omit location properties throughout reporting', () => {
  const events: GtfsReportEvent[] = [];
  const reporting = {
    reporter: (event: GtfsReportEvent) => events.push(event),
  };
  const error = new GtfsError('File missing', {
    code: 'GTFS_SOURCE_READ_FAILED',
    details: { filename: 'stops.txt' },
  });
  log(reporting, 'error', error);
  validationNotice(
    reporting,
    {
      code: 'GTFS_REQUIRED_HEADER_MISSING',
      severity: 'error',
      filename: 'stops.txt',
      message: 'Required header missing',
    },
    'import',
  );
  for (const item of [
    error,
    ...events,
    events[0]?.type === 'message' ? events[0].error : undefined,
    events[1]?.type === 'validation:notice' ? events[1].notice : undefined,
  ]) {
    assert.ok(item);
    for (const key of ['position', 'positions', 'firstPosition']) {
      assert.equal(Object.hasOwn(item, key), false, key);
    }
  }
});

test('notices and reporter events copy immutable positions', () => {
  const events: GtfsReportEvent[] = [];
  const position = { ...csv };
  const firstPosition = { ...csv, recordNumber: 1, csvLineNumber: 3 };
  validationNotice(
    { reporter: (event) => events.push(event) },
    {
      code: 'GTFS_DUPLICATE_PRIMARY_KEY',
      severity: 'warn',
      message: 'Duplicate key',
      filename: 'stops.txt',
      position,
      firstPosition,
    },
    'import',
  );
  const event = events[0];
  assert.ok(event?.type === 'validation:notice');
  assert.deepEqual(event.position, csv);
  assert.deepEqual(event.firstPosition, firstPosition);
  assert.deepEqual(event.notice.position, csv);
  assert.deepEqual(event.notice.firstPosition, firstPosition);
  for (const item of [
    event.position,
    event.firstPosition,
    event.notice.position,
    event.notice.firstPosition,
  ]) {
    assert.ok(Object.isFrozen(item));
  }
  assert.notEqual(event.position, position);
  assert.notEqual(event.notice.firstPosition, firstPosition);
});

for (const [position, description] of [
  [csv, 'CSV record 2 (ending at line 5)'],
  [geojson, 'feature 3'],
  [realtime, 'Realtime entity 4'],
] satisfies [GtfsSourcePosition, string][]) {
  test(`formats ${position.kind} locations in developer diagnostics`, () => {
    assert.equal(formatGtfsSourcePosition(position), description);
    const error = new GtfsError('Invalid record', {
      code: 'GTFS_INVALID_VALUE',
      position,
    });
    assert.equal(
      formatGtfsError(error, { audience: 'user' }),
      'Invalid record',
    );
    assert.equal(
      formatGtfsError(error),
      `GTFS_INVALID_VALUE: Invalid record | category=validation | position=${JSON.stringify(position)}`,
    );
    const batch = new GtfsError('Insert failed', {
      code: 'GTFS_DATABASE_OPERATION_FAILED',
      positions: [position],
    });
    assert.equal(
      formatGtfsError(batch),
      `GTFS_DATABASE_OPERATION_FAILED: Insert failed | category=database | positions=${JSON.stringify([position])}`,
    );
  });
}
