import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GtfsError,
  GtfsErrorCode,
  GtfsValidationNoticeCode,
} from '../../src/diagnostics/errors.ts';
import {
  addImportError,
  addValidationNotice,
  createGtfsImportResult,
  createGtfsImportSourceResult,
  finishGtfsImportResult,
} from '../../src/schedule/import/result.ts';
import { VALIDATION_SAMPLE_LIMIT } from '../../src/validation/summary.ts';

test('import results start successful with independent accumulators', () => {
  const first = createGtfsImportResult();
  const second = createGtfsImportResult();
  assert.deepEqual(first, {
    errors: [],
    errorCountsByCode: {},
    validation: {
      samples: [],
      countsByCode: {},
      countsBySeverity: { error: 0, warn: 0, info: 0 },
      truncated: false,
    },
    sources: [],
    success: true,
  });
  assert.deepEqual(second, first);
  for (const key of [
    'errors',
    'errorCountsByCode',
    'validation',
    'sources',
  ] as const) {
    assert.notEqual(first[key], second[key]);
  }
});

test('bounds samples during collection while counting notices beyond the cap', () => {
  const result = createGtfsImportResult();
  for (let index = 0; index < 10_000; index++) {
    addValidationNotice(result, {
      code: GtfsValidationNoticeCode.INVALID_VALUE,
      severity: index < VALIDATION_SAMPLE_LIMIT ? 'warn' : 'error',
      filename: 'stops.txt',
      message: String(index),
    });
    assert.ok(result.validation.samples.length <= VALIDATION_SAMPLE_LIMIT);
    assert.equal(result.validation.truncated, index >= VALIDATION_SAMPLE_LIMIT);
  }
  assert.equal(
    result.validation.countsByCode[GtfsValidationNoticeCode.INVALID_VALUE],
    10_000,
  );
  assert.deepEqual(result.validation.countsBySeverity, {
    warn: 100,
    error: 9900,
    info: 0,
  });
  assert.equal(result.validation.samples[99]?.message, '99');
});

test('completed results freeze source, file, and validation containers', () => {
  const result = createGtfsImportResult();
  const source = createGtfsImportSourceResult('metro');
  source.success = true;
  source.files.push({
    filename: 'stops.txt',
    recordsRead: 4,
    rowsInserted: 3,
    rowsSkipped: 1,
  });
  result.sources.push(source);
  const completed = finishGtfsImportResult(result, 12);
  assert.equal(completed.durationMs, 12);
  for (const value of [
    completed,
    completed.sources,
    completed.sources[0],
    completed.sources[0]?.files,
    completed.sources[0]?.files[0],
    completed.validation,
    completed.validation.samples,
    completed.validation.countsByCode,
  ]) {
    assert.equal(Object.isFrozen(value), true);
  }
  const file = source.files[0];
  assert.ok(file);
  file.rowsInserted = 0;
  assert.equal(completed.sources[0]?.files[0]?.rowsInserted, 3);
});

test('validation notices retain order and counts without changing import success', () => {
  const result = createGtfsImportResult();
  const notices = [
    { code: GtfsValidationNoticeCode.UNKNOWN_FIELD, severity: 'warn' },
    {
      code: GtfsValidationNoticeCode.REQUIRED_VALUE_MISSING,
      severity: 'error',
    },
    { code: GtfsValidationNoticeCode.UNKNOWN_FIELD, severity: 'info' },
  ] as const;
  const expected = notices.map((notice) => ({
    ...notice,
    message: 'Example notice',
    filename: 'stops.txt',
  }));
  for (const notice of expected) {
    addValidationNotice(result, notice);
  }
  assert.deepEqual(result.validation.samples, expected);
  assert.deepEqual(result.validation.countsByCode, {
    [GtfsValidationNoticeCode.UNKNOWN_FIELD]: 2,
    [GtfsValidationNoticeCode.REQUIRED_VALUE_MISSING]: 1,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.success, true);
});

test('import errors retain order and counts and keep the result unsuccessful', () => {
  const result = createGtfsImportResult();
  const errors = [
    GtfsErrorCode.CSV_PARSE_FAILED,
    GtfsErrorCode.DATABASE_OPERATION_FAILED,
    GtfsErrorCode.CSV_PARSE_FAILED,
  ].map((code) => new GtfsError('Example error', { code }));
  for (const error of errors) {
    addImportError(result, error);
    assert.equal(result.success, false);
  }
  assert.deepEqual(result.errors, errors);
  assert.deepEqual(result.errorCountsByCode, {
    [GtfsErrorCode.CSV_PARSE_FAILED]: 2,
    [GtfsErrorCode.DATABASE_OPERATION_FAILED]: 1,
  });
  addValidationNotice(result, {
    code: GtfsValidationNoticeCode.UNKNOWN_FIELD,
    severity: 'warn',
    message: 'Example notice',
    filename: 'stops.txt',
  });
  assert.equal(result.success, false);
});
