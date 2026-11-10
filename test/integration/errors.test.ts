import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  formatGtfsError,
  Gtfs,
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
  importGtfs,
  isGtfsError,
} from '../../src/index.ts';
// Structured details are asserted at their producers in the parser, download,
// export, repository, and CLI suites; this matrix checks only code categories.
const publicErrorContracts = [
  {
    code: GtfsErrorCode.OPERATION_CANCELLED,
    category: GtfsErrorCategory.CANCELLATION,
  },
  {
    code: GtfsErrorCode.DOWNLOAD_HTTP_FAILED,
    category: GtfsErrorCategory.DOWNLOAD,
  },
  {
    code: GtfsErrorCode.DOWNLOAD_FAILED,
    category: GtfsErrorCategory.DOWNLOAD,
  },
  {
    code: GtfsErrorCode.DOWNLOAD_REDIRECT_REJECTED,
    category: GtfsErrorCategory.DOWNLOAD,
  },
  {
    code: GtfsErrorCode.REALTIME_PROTOBUF_INVALID,
    category: GtfsErrorCategory.PARSE,
  },
  { code: GtfsErrorCode.ZIP_INVALID, category: GtfsErrorCategory.ZIP },
  { code: GtfsErrorCode.ZIP_LIMIT_EXCEEDED, category: GtfsErrorCategory.ZIP },
  {
    code: GtfsErrorCode.DOWNLOAD_TOO_LARGE,
    category: GtfsErrorCategory.DOWNLOAD,
  },
  {
    code: GtfsErrorCode.REQUIRED_VALUE_MISSING,
    category: GtfsErrorCategory.VALIDATION,
  },
  {
    code: GtfsErrorCode.INVALID_DATE,
    category: GtfsErrorCategory.VALIDATION,
  },
  {
    code: GtfsErrorCode.INVALID_VALUE,
    category: GtfsErrorCategory.VALIDATION,
  },
  {
    code: GtfsErrorCode.VALIDATION_FAILED,
    category: GtfsErrorCategory.VALIDATION,
  },
  {
    code: GtfsErrorCode.REALTIME_FEED_TYPE_MISMATCH,
    category: GtfsErrorCategory.VALIDATION,
  },
  {
    code: GtfsErrorCode.REALTIME_SCHEDULE_CHANGED,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.CONFIG_INVALID,
    category: GtfsErrorCategory.CONFIG,
  },
  {
    code: GtfsErrorCode.CONFIG_FILE_NOT_FOUND,
    category: GtfsErrorCategory.CONFIG,
  },
  {
    code: GtfsErrorCode.CONFIG_PARSE_FAILED,
    category: GtfsErrorCategory.CONFIG,
  },
  {
    code: GtfsErrorCode.DATABASE_OPEN_FAILED,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.DATABASE_NOT_FOUND,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.DATABASE_SOURCE_EXISTS,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.DATABASE_SOURCE_NOT_FOUND,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.SCHEMA_INVALID,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.EXTENSION_DISABLED,
    category: GtfsErrorCategory.QUERY,
  },
  { code: GtfsErrorCode.JSON_INVALID, category: GtfsErrorCategory.PARSE },
  {
    code: GtfsErrorCode.UNSUPPORTED_FILE_TYPE,
    category: GtfsErrorCategory.PARSE,
  },
  {
    code: GtfsErrorCode.CSV_PARSE_FAILED,
    category: GtfsErrorCategory.PARSE,
  },
  { code: GtfsErrorCode.QUERY_INVALID, category: GtfsErrorCategory.QUERY },
  {
    code: GtfsErrorCode.INSTANCE_CLOSED,
    category: GtfsErrorCategory.DATABASE,
  },
  {
    code: GtfsErrorCode.SOURCE_READ_FAILED,
    category: GtfsErrorCategory.SOURCE,
  },
  {
    code: GtfsErrorCode.EXPORT_WRITE_FAILED,
    category: GtfsErrorCategory.EXPORT,
  },
  {
    code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
    category: GtfsErrorCategory.EXPORT,
  },
] as const;
async function captureGtfsError(
  operation: () => unknown | Promise<unknown>,
): Promise<GtfsError> {
  try {
    await operation();
  } catch (error: unknown) {
    assert.ok(isGtfsError(error));
    return error;
  }
  throw new assert.AssertionError({ message: 'Expected a GtfsError' });
}
describe('gtfs errors', () => {
  it('formats actual query errors with BigInt details and circular diagnostics', async () => {
    const gtfs = new Gtfs({
      database: {},
      extensions: ['gtfs-realtime'],
    });
    try {
      const error = await captureGtfsError(() =>
        gtfs.realtime.alerts.where({ impactActiveAt: -1n }).all(),
      );
      assert.match(formatGtfsError(error), /"value":"-1"/u);
      assert.equal(formatGtfsError(error, { audience: 'user' }), error.message);
      const details: Record<string, unknown> = { nested: { value: 123n } };
      details.self = details;
      const diagnostic = new GtfsError('Circular diagnostic', {
        code: GtfsErrorCode.QUERY_INVALID,
        details,
      });
      assert.match(
        formatGtfsError(diagnostic),
        /"nested":\{"value":"123"\},"self":"\[Circular\]"/u,
      );
    } finally {
      await gtfs.close();
    }
  });
  it('recognizes structural errors and rejects malformed error objects', () => {
    const valid = {
      name: 'GtfsError',
      message: 'Invalid value',
      code: GtfsErrorCode.INVALID_VALUE,
      category: GtfsErrorCategory.VALIDATION,
      isOperational: true,
    };
    assert.equal(isGtfsError(valid), true);
    assert.equal(isGtfsError({ ...valid, isOperational: false }), true);
    for (const value of [
      null,
      undefined,
      false,
      0,
      '',
      'GtfsError',
      [],
      {},
      new Error('ordinary'),
      () => valid,
    ]) {
      assert.equal(isGtfsError(value), false, String(value));
    }
    for (const field of Object.keys(valid)) {
      const missing = Object.fromEntries(
        Object.entries(valid).filter(([key]) => key !== field),
      );
      assert.equal(isGtfsError(missing), false, `missing ${field}`);
      for (const value of [undefined, null, 1, {}, []]) {
        const malformed = { ...valid, [field]: value };
        assert.equal(isGtfsError(malformed), false, `invalid ${field}`);
      }
    }
    assert.equal(isGtfsError({ ...valid, name: 'Error' }), false);
    assert.equal(isGtfsError({ ...valid, isOperational: 'true' }), false);
  });
  it('formats the exact user/developer matrix without stacks or causes', () => {
    const simple = new GtfsError('Invalid query', {
      code: GtfsErrorCode.QUERY_INVALID,
    });
    const detailed = new GtfsError('Download failed', {
      code: GtfsErrorCode.DOWNLOAD_HTTP_FAILED,
      statusCode: 503,
      details: { sourceId: 'north', attempts: 3 },
      cause: new Error('private cause'),
    });
    const cases = [
      {
        error: simple,
        user: 'Invalid query',
        developer: 'GTFS_QUERY_INVALID: Invalid query | category=query',
      },
      {
        error: detailed,
        user: 'Download failed',
        developer:
          'GTFS_DOWNLOAD_HTTP_FAILED: Download failed | category=download | statusCode=503 | details={"sourceId":"north","attempts":3}',
      },
      {
        error: new GtfsError('Empty context', {
          code: GtfsErrorCode.QUERY_INVALID,
          details: {},
        }),
        user: 'Empty context',
        developer:
          'GTFS_QUERY_INVALID: Empty context | category=query | details={}',
      },
      {
        error: new Error('boom'),
        user: 'boom',
        developer: 'UNKNOWN_ERROR: boom',
      },
      ...['plain text', null, undefined, 42, { message: 'not an Error' }].map(
        (error) => ({
          error,
          user: String(error),
          developer: `UNKNOWN_ERROR: ${String(error)}`,
        }),
      ),
    ];
    for (const { error, user, developer } of cases) {
      assert.equal(formatGtfsError(error, { audience: 'user' }), user);
      assert.equal(
        formatGtfsError(error, { audience: 'developer' }),
        developer,
      );
      assert.equal(formatGtfsError(error), developer);
    }
  });
  it('defines the category for every public error code', () => {
    assert.deepEqual(
      publicErrorContracts.map(({ code }) => code).sort(),
      Object.values(GtfsErrorCode).sort(),
    );
    for (const { code, category } of publicErrorContracts) {
      const error = new GtfsError('Example error', { code });
      assert.equal(error.code, code);
      assert.equal(error.category, category);
    }
  });
  it('rejects category overrides that conflict with an error code', () => {
    assert.throws(
      () =>
        new GtfsError('Wrong category', {
          code: GtfsErrorCode.ZIP_INVALID,
          category: GtfsErrorCategory.DATABASE,
        }),
      /belongs to category zip, not database/u,
    );
  });
  it('should throw a typed config validation error', async () => {
    let didThrow = false;
    try {
      await importGtfs({
        database: { path: ':memory:' },
        sources: [{} as never],
        reporting: { level: 'silent' as const },
      });
    } catch (error: unknown) {
      didThrow = true;
      assert.ok(isGtfsError(error));
      if (isGtfsError(error)) {
        assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
      }
    }
    assert.ok(didThrow);
  });
  it('returns a structured report when continuing after a source error', async () => {
    const report = await importGtfs({
      database: { path: ':memory:' },
      sources: [
        {
          sourceId: 'test',
          schedule: {
            path: '/does/not/exist',
            import: { onSourceError: 'continue', validation: {} },
          },
        },
      ],
      reporting: { level: 'silent' as const },
    });
    assert.ok(report.errors.length > 0);
    assert.equal(report.errorCountsByCode[GtfsErrorCode.SOURCE_READ_FAILED], 1);
    assert.equal(report.errors[0]!.details?.sourcePath, '/does/not/exist');
  });
  it('should format developer-safe error details', () => {
    const output = formatGtfsError(new Error('boom'), {
      audience: 'developer',
    });
    assert.ok(output.includes('UNKNOWN_ERROR: boom'));
  });

  it('wraps owned SQLite open failures with the public database code', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-open-error-'));
    const filename = path.join(directory, 'missing-parent', 'gtfs.sqlite');
    try {
      assert.throws(
        () => new Gtfs({ database: { path: filename } }),
        (error: unknown) =>
          isGtfsError(error) &&
          error.code === GtfsErrorCode.DATABASE_OPEN_FAILED &&
          error.category === 'database',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('reports invalid ZIP and malformed CSV inputs with parse context', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-parse-errors-'));
    const invalidZip = path.join(directory, 'invalid.zip');
    const invalidCsv = path.join(directory, 'invalid-csv');
    try {
      await writeFile(invalidZip, 'not a ZIP archive');
      const zipError = await captureGtfsError(() =>
        importGtfs({
          database: { path: ':memory:' },
          sources: [
            { sourceId: 'invalid-zip', schedule: { path: invalidZip } },
          ],
          reporting: { level: 'silent' },
        }),
      );
      assert.equal(zipError.code, GtfsErrorCode.ZIP_INVALID);
      assert.equal(zipError.category, GtfsErrorCategory.ZIP);
      assert.equal(zipError.details?.sourcePath, invalidZip);
      await mkdir(invalidCsv);
      await writeFile(
        path.join(invalidCsv, 'agency.txt'),
        'agency_id,agency_name\nagency-1,"unterminated\n',
      );
      const csvError = await captureGtfsError(() =>
        importGtfs({
          database: { path: ':memory:' },
          sources: [
            { sourceId: 'invalid-csv', schedule: { path: invalidCsv } },
          ],
          reporting: { level: 'silent' },
        }),
      );
      assert.equal(csvError.code, GtfsErrorCode.CSV_PARSE_FAILED);
      assert.equal(csvError.category, GtfsErrorCategory.PARSE);
      assert.equal(csvError.details?.filename, 'agency.txt');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
