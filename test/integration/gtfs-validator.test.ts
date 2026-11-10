import path from 'node:path';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

import {
  compiledTableRegistry,
  fileBackedTables,
} from '../../src/schema/table-registry.ts';
import {
  GtfsErrorCode,
  GtfsValidationNoticeCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';
import { importGtfs } from '../../src/index.ts';
import { describe, it } from 'node:test';

const fixture = (...parts: string[]) =>
  path.join('test/fixtures/v4-baseline', ...parts);

describe('manifest-driven GTFS validation', () => {
  it('collects required-file errors before strict rejection is decided', async (t) => {
    const staged = await stageGtfsSource({
      directory: fixture('missing-required-files'),
      tables: fileBackedTables,
      mode: 'strict',
      onUnknownField: 'preserve',
      sourceId: 'missing-files',
    });
    t.after(() => staged.close());
    const result = staged.validation;

    assert.equal(result.shouldReject, true);
    assert.equal(result.valid, false);
    assert.equal(
      result.samples.filter(
        (item) => item.code === GtfsValidationNoticeCode.REQUIRED_FILE_MISSING,
      ).length,
      4,
    );
    assert.equal(result.samples[0]!.sourceId, 'missing-files');
  });

  it('preserves unknown fields with a structured nonfatal warning', async (t) => {
    const staged = await stageGtfsSource({
      sourceId: 'test',
      directory: fixture('unknown-fields'),
      tables: fileBackedTables,
      mode: 'permissive',
      onUnknownField: 'preserve',
    });
    t.after(() => staged.close());
    const result = staged.validation;
    const unknown = result.samples.find(
      (item) => item.code === GtfsValidationNoticeCode.UNKNOWN_FIELD,
    );

    assert.equal(unknown?.severity, 'warn');
    assert.equal(unknown?.filename, 'agency.txt');
    assert.equal(unknown?.field, 'extension_color');
    assert.equal(
      unknown?.message,
      'Unknown field "extension_color" in agency.txt will be preserved as JSON in agency._unknown_fields',
    );
    assert.equal(result.shouldReject, false);
  });

  it('rejects unknown fields when the source policy requests it', async (t) => {
    const staged = await stageGtfsSource({
      sourceId: 'test',
      directory: fixture('unknown-fields'),
      tables: fileBackedTables,
      mode: 'strict',
      onUnknownField: 'reject',
    });
    t.after(() => staged.close());
    const result = staged.validation;
    const unknown = result.samples.find(
      (item) => item.code === GtfsValidationNoticeCode.UNKNOWN_FIELD,
    );

    assert.equal(unknown?.severity, 'error');
    assert.equal(result.valid, false);
    assert.equal(result.shouldReject, true);
  });

  it('detects null-containing duplicate primary keys portably', async (t) => {
    const staged = await stageGtfsSource({
      sourceId: 'test',
      directory: fixture('nullable-keys'),
      tables: fileBackedTables,
      mode: 'permissive',
      onUnknownField: 'discard',
    });
    t.after(() => staged.close());
    const result = staged.validation;

    assert.equal(
      result.samples.some(
        (item) =>
          item.code === GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY &&
          item.filename === 'transfers.txt',
      ),
      true,
    );
    assert.equal(result.shouldReject, false);
    assert.equal(result.valid, false);
  });

  it('treats duplicate primary keys as nonfatal validation notices with keep-first', async (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-duplicates-'));
    try {
      await writeFile(
        path.join(directory, 'stops.txt'),
        ['stop_id,stop_name', 'duplicate,First', 'duplicate,Second', ''].join(
          '\n',
        ),
      );
      const staged = await stageGtfsSource({
        sourceId: 'test',
        directory,
        tables: [compiledTableRegistry.stops],
        excludeFiles: ['calendar.txt', 'calendar_dates.txt'],
        mode: 'strict',
        onUnknownField: 'discard',
        onDuplicateKey: 'keep-first',
      });
      t.after(() => staged.close());
      const result = staged.validation;
      const duplicate = result.samples.find(
        (item) => item.code === GtfsValidationNoticeCode.DUPLICATE_PRIMARY_KEY,
      );

      assert.equal(duplicate?.severity, 'warn');
      assert.equal(result.valid, true);
      assert.equal(result.shouldReject, false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('throws one aggregate error when strict validation is enabled', async () => {
    await assert.rejects(
      importGtfs({
        database: { path: ':memory:' },
        sources: [
          {
            sourceId: 'test',
            schedule: {
              path: fixture('missing-required-files'),
              import: { validation: { mode: 'strict' } },
            },
          },
        ],
        reporting: { level: 'silent' },
      }),
      (error: unknown) =>
        isGtfsError(error) &&
        error.code === GtfsErrorCode.VALIDATION_FAILED &&
        Array.isArray(error.details?.validation?.samples),
    );
  });

  it('stores preserved unknown values and reports a stable notice', async () => {
    const db = new Database(':memory:');
    try {
      const report = await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'test',
            schedule: {
              path: fixture('unknown-fields'),
              import: { validation: { mode: 'permissive' } },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
      const row = db.prepare('SELECT _unknown_fields FROM agency').get() as {
        _unknown_fields: string;
      };

      assert.deepEqual(JSON.parse(row._unknown_fields), {
        extension_color: 'blue',
      });
      const notice = report.validation.samples.find(
        (value) => value.code === GtfsValidationNoticeCode.UNKNOWN_FIELD,
      );
      assert.ok(notice);
      assert.equal(notice.severity, 'warn');
      assert.equal(notice.filename, 'agency.txt');
      assert.equal(notice.field, 'extension_color');
      assert.ok(notice.message.length > 0);
      assert.equal(
        report.validation.countsByCode[GtfsValidationNoticeCode.UNKNOWN_FIELD],
        1,
      );
      assert.equal(report.success, true);
    } finally {
      db.close();
    }
  });

  it('can continue with a later independent source after strict failure', async () => {
    const db = new Database(':memory:');
    try {
      const report = await importGtfs({
        database: { client: db },
        sources: [
          {
            sourceId: 'invalid-source',
            schedule: {
              path: fixture('missing-required-files'),
              import: {
                onSourceError: 'continue',
                validation: {
                  mode: 'strict',
                  onUnknownField: 'discard',
                },
              },
            },
          },
          {
            sourceId: 'complete-source',
            schedule: {
              path: 'test/fixtures/complete',
              import: {
                onSourceError: 'continue',
                validation: {
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      });
      const agencyCount = db
        .prepare('SELECT COUNT(*) FROM agency')
        .pluck()
        .get();

      assert.equal(agencyCount, 1);
      assert.equal(
        report.errorCountsByCode[GtfsErrorCode.VALIDATION_FAILED],
        1,
      );
      assert.equal(report.success, false);
    } finally {
      db.close();
    }
  });
});
