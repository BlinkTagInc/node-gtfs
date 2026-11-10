import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveGtfsImportConfig } from '../../src/config/resolver.ts';
import {
  GtfsErrorCategory,
  GtfsErrorCode,
  isGtfsError,
} from '../../src/diagnostics/errors.ts';
import type { GtfsConfigIssue } from '../../src/config/validation.ts';

const optionPath = 'sources[0].schedule.import.csv';
const defaults = {
  encoding: 'utf8',
  delimiter: ',',
  quote: '"',
  escape: '"',
  trim: true,
  skipEmptyLines: true,
  relaxQuotes: true,
};

function resolve(csv: unknown, format: 'javascript' | 'json') {
  return resolveGtfsImportConfig(
    {
      database: { path: ':memory:' },
      sources: [{ schedule: { path: './feed.zip', import: { csv } } }],
    },
    { format },
  );
}

function issuesFor(
  csv: unknown,
  format: 'javascript' | 'json',
): readonly GtfsConfigIssue[] {
  try {
    resolve(csv, format);
    assert.fail('Expected invalid CSV configuration');
  } catch (error) {
    assert.ok(isGtfsError(error));
    assert.equal(error.code, GtfsErrorCode.CONFIG_INVALID);
    assert.equal(error.category, GtfsErrorCategory.CONFIG);
    const issues = error.details?.errors;
    assert.ok(issues);
    return issues;
  }
}

describe('supported CSV configuration', () => {
  for (const format of ['javascript', 'json'] as const) {
    test(`${format}: rejects BOM configuration because detection is always enabled`, () => {
      for (const bom of [true, false, undefined]) {
        assert.deepEqual(issuesFor({ bom }, format), [
          {
            reason: 'unknown-option',
            path: `${optionPath}.bom`,
            message: `Unsupported CSV configuration option \`${optionPath}.bom\`; byte-order marks are always recognized; remove this option`,
          },
        ]);
      }
    });

    test(`${format}: resolves defaults and copies/freezes supported options`, () => {
      const configured = resolve(undefined, format).sources[0]?.schedule?.import
        .csv;
      assert.deepEqual(configured, defaults);
      const input = {
        encoding: 'utf16le',
        delimiter: ';',
        quote: false,
        escape: '\\',
        trim: false,
        skipEmptyLines: false,
        relaxQuotes: false,
      };
      const options = resolve(input, format).sources[0]?.schedule?.import.csv;
      assert.deepEqual(options, input);
      assert.notEqual(options, input);
      assert.ok(Object.isFrozen(options));
      input.trim = true;
      assert.equal(options?.trim, false);
    });

    test(`${format}: rejects alternate spellings with the canonical path`, () => {
      for (const [oldKey, newKey] of [
        ['skip_empty_lines', 'skipEmptyLines'],
        ['relax_quotes', 'relaxQuotes'],
      ] as const) {
        assert.deepEqual(issuesFor({ [oldKey]: false }, format), [
          {
            reason: 'unknown-option',
            path: `${optionPath}.${oldKey}`,
            suggestion: `${optionPath}.${newKey}`,
            message: `Unsupported CSV configuration option \`${optionPath}.${oldKey}\`; use \`${optionPath}.${newKey}\``,
          },
        ]);
      }
      assert.equal(
        issuesFor({ skip_empty_lines: false, skipEmptyLines: true }, format)
          .length,
        1,
      );
    });

    test(`${format}: rejects incompatible options even when disabled`, () => {
      const groups = [
        [
          'columns',
          'objname',
          'groupColumnsByName',
          'group_columns_by_name',
          'raw',
          'info',
        ],
        ['cast', 'castDate', 'cast_date', 'auto_parse', 'auto_parse_date'],
        ['onRecord', 'on_record', 'onSkip', 'on_skip'],
        [
          'relaxColumnCount',
          'relax_column_count',
          'relaxColumnCountLess',
          'relax_column_count_less',
          'relaxColumnCountMore',
          'relax_column_count_more',
          'ignoreLastDelimiters',
        ],
        [
          'skipRecordsWithEmptyValues',
          'skip_records_with_empty_values',
          'skipRecordsWithError',
          'skip_records_with_error',
          'from',
          'fromLine',
          'from_line',
          'to',
          'toLine',
          'to_line',
        ],
        [
          'recordDelimiter',
          'record_delimiter',
          'delimiterAuto',
          'delimiter_auto',
          'comment',
          'comment_no_infix',
        ],
      ];
      for (const key of groups.flat()) {
        for (const value of [
          false,
          undefined,
          () => assert.fail('Callbacks must not run'),
        ]) {
          const issues = issuesFor({ [key]: value }, format);
          assert.equal(issues.length, 1);
          assert.equal(issues[0]?.reason, 'unknown-option');
          assert.equal(issues[0]?.path, `${optionPath}.${key}`);
          assert.match(
            issues[0]?.message ?? '',
            /Unsupported CSV configuration option .*; /,
          );
        }
      }
      assert.match(
        issuesFor({ onRecord: () => undefined }, format)[0]?.message ?? '',
        /preprocess the feed/,
      );
      for (const key of [
        'bogus',
        'highWaterMark',
        'max_record_size',
        'constructor',
      ]) {
        assert.deepEqual(issuesFor({ [key]: 1 }, format), [
          {
            reason: 'unknown-option',
            path: `${optionPath}.${key}`,
            message: `Unknown configuration option \`${optionPath}.${key}\``,
          },
        ]);
      }
    });

    test(`${format}: validates primitive values and character constraints`, () => {
      for (const key of ['trim', 'skipEmptyLines', 'relaxQuotes']) {
        for (const value of [null, 0, 'true', {}, [], () => true]) {
          assert.deepEqual(issuesFor({ [key]: value }, format), [
            {
              reason: 'invalid-type',
              path: `${optionPath}.${key}`,
              message: `Configuration option \`${optionPath}.${key}\` must be a boolean`,
            },
          ]);
        }
      }
      for (const value of [
        null,
        false,
        true,
        'utf-8',
        'UTF8',
        'ucs2',
        'binary',
        'base64',
        'hex',
        Buffer.from('utf8'),
      ]) {
        assert.equal(
          issuesFor({ encoding: value }, format)[0]?.path,
          `${optionPath}.encoding`,
        );
      }
      for (const key of ['delimiter', 'quote', 'escape']) {
        for (const value of [
          '',
          '||',
          '\n',
          '\r',
          '\0',
          '\ud800',
          null,
          true,
          [],
          Buffer.from(';'),
        ]) {
          assert.equal(
            issuesFor({ [key]: value }, format)[0]?.path,
            `${optionPath}.${key}`,
          );
        }
      }
      for (const key of ['delimiter', 'escape']) {
        assert.equal(
          issuesFor({ [key]: false }, format)[0]?.path,
          `${optionPath}.${key}`,
        );
      }
      assert.equal(
        issuesFor({ delimiter: '"' }, format)[0]?.reason,
        'invalid-combination',
      );
      assert.equal(
        issuesFor({ encoding: 'latin1', delimiter: '💡' }, format)[0]?.path,
        `${optionPath}.delimiter`,
      );
      assert.equal(
        resolve({ encoding: 'latin1', delimiter: 'é' }, format).sources[0]
          ?.schedule?.import.csv.delimiter,
        'é',
      );
      for (const value of [null, false, '', [], new Date()]) {
        assert.equal(issuesFor(value, format)[0]?.path, optionPath);
      }
    });
  }

  test('accumulates CSV issues alongside other source validation issues', () => {
    assert.throws(
      () =>
        resolveGtfsImportConfig({
          database: { path: ':memory:' },
          sources: [
            {
              schedule: {
                path: './feed.zip',
                import: {
                  csv: { cast: true, trim: 'yes', encoding: false },
                  validation: { mode: 'unknown' },
                },
              },
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(isGtfsError(error));
        const issues = error.details?.errors;
        assert.ok(issues);
        assert.deepEqual(issues.map(({ path }) => path).sort(), [
          `${optionPath}.cast`,
          `${optionPath}.encoding`,
          `${optionPath}.trim`,
          'sources[0].schedule.import.validation.mode',
        ]);
        return true;
      },
    );
  });
});
