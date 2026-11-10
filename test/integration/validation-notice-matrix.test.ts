import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';

import {
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  isGtfsError,
  type GtfsValidationNotice,
} from '../../src/diagnostics/errors.ts';
import { createRealtimeSnapshotApplication } from '../../src/realtime/snapshot.ts';
import type { RawRealtimeEntity } from '../../src/realtime/normalizer.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import type { GtfsValidationMode } from '../../src/validation/types.ts';
import {
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../src/schema/table-registry.ts';

interface ModeExpectation {
  readonly noticePresent: boolean;
  readonly valid: boolean;
  readonly shouldReject: boolean;
  readonly normalizationError?: GtfsErrorCode;
}

interface ScheduleNoticeContract {
  readonly name: string;
  readonly code: GtfsValidationNotice['code'];
  readonly severity: GtfsValidationNotice['severity'];
  readonly filename: string;
  readonly position: GtfsValidationNotice['position'];
  readonly field: string | undefined;
  readonly message: string;
  readonly files: Readonly<Record<string, string>>;
  readonly tables: readonly FileBackedCompiledGtfsTable[];
  readonly excludeFiles?: readonly string[];
  readonly modes: Readonly<Record<GtfsValidationMode, ModeExpectation>>;
}

const errorModes = {
  off: { noticePresent: false, valid: true, shouldReject: false },
  strict: { noticePresent: true, valid: false, shouldReject: true },
  permissive: { noticePresent: true, valid: false, shouldReject: false },
} as const satisfies Readonly<Record<GtfsValidationMode, ModeExpectation>>;

const semanticWarningModes = {
  off: { noticePresent: false, valid: true, shouldReject: false },
  strict: { noticePresent: true, valid: true, shouldReject: false },
  permissive: { noticePresent: true, valid: true, shouldReject: false },
} as const satisfies Readonly<Record<GtfsValidationMode, ModeExpectation>>;

const conditionalAgencyTable: FileBackedCompiledGtfsTable = {
  ...compiledTableRegistry.agency,
  constraints: [
    {
      kind: 'conditional-presence',
      field: 'agency_lang',
      presence: 'required',
      when: { field: 'agency_timezone', equals: 'Etc/UTC' },
    },
  ],
};

const scheduleNoticeContracts = [
  {
    name: 'missing required header',
    code: GtfsValidationNoticeCode.REQUIRED_HEADER_MISSING,
    severity: 'error',
    filename: 'agency.txt',
    position: undefined,
    field: 'agency_name',
    message: 'agency.txt is missing required header "agency_name"',
    files: {
      'agency.txt': 'agency_id,agency_url,agency_timezone\n',
    },
    tables: [compiledTableRegistry.agency],
    modes: errorModes,
  },
  {
    name: 'missing required value',
    code: GtfsValidationNoticeCode.REQUIRED_VALUE_MISSING,
    severity: 'error',
    filename: 'agency.txt',
    position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
    field: 'agency_name',
    message:
      'agency.txt CSV record 1 (ending at line 2) is missing required value "agency_name"',
    files: {
      'agency.txt': [
        'agency_id,agency_name,agency_url,agency_timezone',
        'agency-1,,https://example.test,Etc/UTC',
      ].join('\n'),
    },
    tables: [compiledTableRegistry.agency],
    modes: {
      ...errorModes,
      off: {
        ...errorModes.off,
        normalizationError: GtfsErrorCode.REQUIRED_VALUE_MISSING,
      },
    },
  },
  {
    name: 'invalid primitive value',
    code: GtfsValidationNoticeCode.INVALID_VALUE,
    severity: 'error',
    filename: 'calendar_dates.txt',
    position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
    field: 'date',
    message:
      'calendar_dates.txt CSV record 1 (ending at line 2) has invalid date value for "date"',
    files: {
      'calendar_dates.txt': [
        'service_id,date,exception_type',
        'service-1,not-a-date,1',
      ].join('\n'),
    },
    tables: [compiledTableRegistry.calendarDates],
    excludeFiles: [],
    modes: {
      ...errorModes,
      off: {
        ...errorModes.off,
        normalizationError: GtfsErrorCode.INVALID_DATE,
      },
    },
  },
  {
    name: 'out-of-range value',
    code: GtfsValidationNoticeCode.RANGE,
    severity: 'error',
    filename: 'calendar_dates.txt',
    position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
    field: 'exception_type',
    message:
      'calendar_dates.txt CSV record 1 (ending at line 2) has an out-of-range value for "exception_type"',
    files: {
      'calendar_dates.txt': [
        'service_id,date,exception_type',
        'service-1,20260101,3',
      ].join('\n'),
    },
    tables: [compiledTableRegistry.calendarDates],
    excludeFiles: [],
    modes: errorModes,
  },
  {
    name: 'conditional presence violation',
    code: GtfsValidationNoticeCode.CONDITIONAL_PRESENCE,
    severity: 'error',
    filename: 'agency.txt',
    position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
    field: 'agency_lang',
    message:
      'agency.txt CSV record 1 (ending at line 2) violates conditional presence for "agency_lang"',
    files: {
      'agency.txt': [
        'agency_id,agency_name,agency_url,agency_timezone,agency_lang',
        'agency-1,Agency,https://example.test,Etc/UTC,',
      ].join('\n'),
    },
    tables: [conditionalAgencyTable],
    modes: errorModes,
  },
  {
    name: 'missing advisory reference',
    code: GtfsValidationNoticeCode.REFERENCE_NOT_FOUND,
    severity: 'warn',
    filename: 'stops.txt',
    position: { kind: 'csv', recordNumber: 1, csvLineNumber: 2 },
    field: 'parent_station',
    message:
      'stops.txt CSV record 1 (ending at line 2) references missing stops.txt.stop_id',
    files: {
      'stops.txt': 'stop_id,parent_station\nchild,missing-parent\n',
    },
    tables: [compiledTableRegistry.stops],
    modes: semanticWarningModes,
  },
] as const satisfies readonly ScheduleNoticeContract[];

const validationModes = [
  'off',
  'strict',
  'permissive',
] as const satisfies readonly GtfsValidationMode[];

describe('Schedule validation notice contracts', () => {
  for (const contract of scheduleNoticeContracts) {
    test(contract.name, async (t) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-validation-notice-'),
      );
      try {
        await Promise.all(
          Object.entries(contract.files).map(([filename, contents]) =>
            writeFile(path.join(directory, filename), contents),
          ),
        );

        for (const mode of validationModes) {
          const expectation: ModeExpectation = contract.modes[mode];
          const options = {
            directory,
            tables: contract.tables,
            mode,
            onUnknownField: 'discard' as const,
            sourceId: 'notice-matrix',
            excludeFiles:
              'excludeFiles' in contract
                ? contract.excludeFiles
                : ['calendar.txt', 'calendar_dates.txt'],
          };
          if (expectation.normalizationError !== undefined) {
            await assert.rejects(stageGtfsSource(options), (error) => {
              assert.ok(isGtfsError(error));
              assert.equal(error.code, expectation.normalizationError);
              assert.deepEqual(error.position, contract.position);
              assert.equal(error.details?.filename, contract.filename);
              assert.equal(error.details?.field, contract.field);
              return true;
            });
            continue;
          }
          const staged = await stageGtfsSource(options);
          t.after(() => staged.close());
          const result = staged.validation;
          const matchingNotices = result.samples.filter(
            (notice) => notice.code === contract.code,
          );

          assert.equal(
            matchingNotices.length,
            expectation.noticePresent ? 1 : 0,
            `${contract.code} notice count in ${mode}`,
          );
          assert.equal(result.valid, expectation.valid, `${mode} valid`);
          assert.equal(
            result.shouldReject,
            expectation.shouldReject,
            `${mode} shouldReject`,
          );

          if (!expectation.noticePresent) {
            continue;
          }
          const notice = matchingNotices[0];
          assert.ok(notice);
          assert.equal(notice.severity, contract.severity);
          assert.equal(notice.filename, contract.filename);
          assert.deepEqual(notice.position, contract.position);
          assert.equal(notice.field, contract.field);
          assert.equal(notice.message, contract.message);
          assert.equal(notice.sourceId, 'notice-matrix');
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
});

describe('Realtime validation notice contracts', () => {
  test('unsupported entity normalization retains history with a complete warning', () => {
    const unsupportedEntity = {
      id: 'unsupported-alert',
      alert: {
        headerText: {
          translation: [{ text: { unsupported: true } }],
        },
      },
    } as unknown as RawRealtimeEntity;
    const result = createRealtimeSnapshotApplication(
      {
        contentType: 'application/x-protobuf',
        feed: {
          header: {
            gtfsRealtimeVersion: '2.0',
            incrementality: 'FULL_DATASET',
            timestamp: 1,
          },
          entity: [unsupportedEntity],
        },
        rawPayload: Buffer.from('unsupported'),
        httpHeaders: {},
        httpStatus: 200,
      },
      {
        currentEntitiesSeconds: 60,
        snapshotsSeconds: 300,
        sourceId: 'notice-matrix',
        nowUnixSeconds: 1,
        realtimeFeedId: 'alerts',
        feedUrl: 'https://user:password@example.test/alerts.pb?api_key=secret',
        declaredFeedType: 'alerts',
      },
    );
    const notices = result.validation.samples.filter(
      (notice) =>
        notice.code === GtfsValidationNoticeCode.REALTIME_ENTITY_UNSUPPORTED,
    );

    assert.equal(notices.length, 1);
    const notice = notices[0];
    assert.ok(notice);
    assert.equal(notice.severity, 'warn');
    assert.equal(notice.filename, 'https://example.test/alerts.pb?api_key=***');
    assert.deepEqual(notice.position, { kind: 'realtime', entityNumber: 1 });
    assert.equal(notice.field, undefined);
    assert.equal(
      notice.message,
      'FeedEntity could not be normalized; raw history was retained',
    );
    assert.equal(notice.sourceId, 'notice-matrix');
    assert.deepEqual(result.snapshot.entities[0]?.currentMutations, []);
    assert.equal('valid' in result, false);
    assert.equal('shouldReject' in result, false);
  });
});
