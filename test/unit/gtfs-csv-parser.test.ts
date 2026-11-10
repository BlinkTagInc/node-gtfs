import assert from 'node:assert/strict';
import { ReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { describe, it } from 'node:test';
import { parse, Parser } from 'csv-parse';
import Database from 'better-sqlite3';

import {
  createGtfsCsvParser,
  readGtfsCsvRecordBatches,
} from '../../src/schedule/import/csv.ts';
import { readGtfsSourceRecordBatches } from '../../src/schedule/import/read-source.ts';
import { importGtfsSourceDirectly } from '../../src/schedule/import/process-source.ts';
import { collectStagedImportBatches } from '../helpers/import-batches.ts';
import { importGtfs } from '../../src/operations.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import type { GtfsCsvParseOptions } from '../../src/types/config.ts';

async function parseRecords(
  contents: string | Buffer,
  options: GtfsCsvParseOptions = {},
) {
  const parser = createGtfsCsvParser(options);
  Readable.from([contents]).pipe(parser);
  const records: Record<string, string>[] = [];
  for await (const { record } of parser) {
    records.push(record);
  }
  return records;
}

describe('GTFS CSV parser', () => {
  it('preserves header order, duplicate-header values, and prototype-named data fields', async () => {
    const csv =
      'id,__proto__,constructor,toString,,id\n' +
      'first,prototype value,constructor value,string value,empty header,last\n' +
      'second,next prototype,next constructor,next string,,final\n';
    const rows = await parseRecords(csv);
    const expected = [
      {
        id: 'last',
        ['__proto__']: 'prototype value',
        constructor: 'constructor value',
        toString: 'string value',
        '': 'empty header',
      },
      {
        id: 'final',
        ['__proto__']: 'next prototype',
        constructor: 'next constructor',
        toString: 'next string',
        '': '',
      },
    ];
    assert.deepEqual(rows, expected);
    for (const row of rows) {
      assert.equal(Object.getPrototypeOf(row), Object.prototype);
      assert.deepEqual(Object.keys(row), [
        'id',
        '__proto__',
        'constructor',
        'toString',
        '',
      ]);
      assert.deepEqual(Object.getOwnPropertyDescriptor(row, '__proto__'), {
        value: row.__proto__,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  });

  it('matches csv-parse object values and record offsets across single-byte input chunks', async () => {
    const csv = Buffer.from(
      '\uFEFFid,"stop,name",id\r\n\r\n' +
        '001,"Café, \\"quoted\\"\r\nstop",002\r\n' +
        '003,"second\rline",004',
    );
    async function collect(parser: Parser) {
      Readable.from([...csv].map((byte) => Buffer.from([byte]))).pipe(parser);
      const rows = [];
      for await (const { record, info } of parser) {
        rows.push({ record, bytes: info.bytes, records: info.records });
      }
      return rows;
    }
    const headers: (readonly string[])[] = [];
    const actual = await collect(
      createGtfsCsvParser({ escape: '\\' }, (fields) => {
        headers.push(fields);
      }),
    );
    const expected = await collect(
      parse({
        columns: true,
        info: true,
        bom: true,
        escape: '\\',
        trim: true,
        skip_empty_lines: true,
        relax_quotes: true,
      }),
    );
    assert.deepEqual(headers, [['id', 'stop,name', 'id']]);
    assert.equal(actual.length, 2);
    assert.deepEqual(actual, expected);
  });

  it('reports headers once for header-only input and propagates header-handler failures', async () => {
    const headers: (readonly string[])[] = [];
    const parser = createGtfsCsvParser({}, (fields) => {
      headers.push(fields);
    });
    Readable.from(['\n\nname,id\n']).pipe(parser);
    const rows = [];
    for await (const row of parser) {
      rows.push(row);
    }
    assert.deepEqual(rows, []);
    assert.deepEqual(headers, [['name', 'id']]);

    const failure = new Error('Header validation failed');
    const failingParser = createGtfsCsvParser({}, () => {
      throw failure;
    });
    Readable.from(['name,id\nName,001\n']).pipe(failingParser);
    await assert.rejects(
      async () => {
        for await (const row of failingParser) {
          assert.fail(
            `Unexpected row after a header failure: ${JSON.stringify(row)}`,
          );
        }
      },
      (error) => error === failure,
    );
  });

  it('preserves string IDs, empty strings, quoted whitespace, and literal comment characters', async () => {
    assert.deepEqual(
      await parseRecords('id,name,empty\n001," spaced ",\n002,#literal,\n'),
      [
        { id: '001', name: ' spaced ', empty: '' },
        { id: '002', name: '#literal', empty: '' },
      ],
    );
  });

  it('applies custom quotes and escapes, and permits disabled quoting', async () => {
    assert.deepEqual(
      await parseRecords("id;name\n001;'it\\'s here'\n", {
        delimiter: ';',
        quote: "'",
        escape: '\\',
      }),
      [{ id: '001', name: "it's here" }],
    );
    assert.deepEqual(
      await parseRecords('id,name\n001,"literal"\n', { quote: false }),
      [{ id: '001', name: '"literal"' }],
    );
    assert.deepEqual(
      await parseRecords('id💡name\n001💡Unicode\n', { delimiter: '💡' }),
      [{ id: '001', name: 'Unicode' }],
    );
  });

  it('honors both values of the boolean options', async () => {
    const csv = '\uFEFFid,name\n001, unquoted \n\n';
    assert.deepEqual(await parseRecords(csv), [
      { id: '001', name: 'unquoted' },
    ]);
    assert.deepEqual(await parseRecords(csv, { trim: false }), [
      { id: '001', name: ' unquoted ' },
    ]);
    assert.deepEqual(
      await parseRecords('id\n\n001\n', { skipEmptyLines: false }),
      [{ id: '' }, { id: '001' }],
    );
    assert.deepEqual(await parseRecords('id,name\n001,a"b\n'), [
      { id: '001', name: 'a"b' },
    ]);
    await assert.rejects(
      parseRecords('id,name\n001,a"b\n', { relaxQuotes: false }),
      { code: 'INVALID_OPENING_QUOTE' },
    );
  });

  for (const encoding of ['utf8', 'utf16le', 'latin1'] as const) {
    it(`decodes ${encoding} and preserves physical line numbers`, async (t) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-csv-encoding-'),
      );
      t.after(() => rm(directory, { recursive: true, force: true }));
      const filePath = path.join(directory, 'agency.txt');
      const csv = 'id,name\r\n001,"Café\r\nMontréal"\r\n002,last\r\n';
      await writeFile(filePath, csv, encoding);
      const entries = [];
      for await (const batch of readGtfsCsvRecordBatches(filePath, {
        encoding,
      })) {
        for (const entry of batch) {
          entries.push(entry);
        }
      }
      assert.deepEqual(
        entries.map(({ record }) => record),
        [
          { id: '001', name: 'Café\r\nMontréal' },
          { id: '002', name: 'last' },
        ],
      );
      assert.deepEqual(
        entries.map(({ position }) => position),
        [
          { kind: 'csv', recordNumber: 1, csvLineNumber: 3 },
          { kind: 'csv', recordNumber: 2, csvLineNumber: 4 },
        ],
      );
    });
  }

  for (const [actualEncoding, configuredEncoding] of [
    ['utf8', undefined],
    ['utf16le', undefined],
    ['utf8', 'utf16le'],
    ['utf16le', 'latin1'],
  ] as const) {
    it(`recognizes the ${actualEncoding} BOM with ${configuredEncoding ?? 'default'} encoding for parsing and line counts`, async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-csv-bom-'));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const filePath = path.join(directory, 'agency.txt');
      await writeFile(
        filePath,
        '\uFEFFid,name\r\n001,Unicode\r\n002,last',
        actualEncoding,
      );
      const entries = [];
      for await (const batch of readGtfsCsvRecordBatches(
        filePath,
        configuredEncoding === undefined
          ? {}
          : { encoding: configuredEncoding },
      )) {
        for (const entry of batch) {
          entries.push(entry);
        }
      }
      assert.deepEqual(
        entries.map(({ record }) => record.id),
        ['001', '002'],
      );
      assert.deepEqual(
        entries.map(({ position }) => position.csvLineNumber),
        [2, 3],
      );
    });
  }

  it('rejects mismatched columns and unterminated quotes instead of discarding data', async () => {
    for (const csv of ['id,name\n001\n', 'id,name\n001,Name,extra\n']) {
      await assert.rejects(parseRecords(csv), {
        code: 'CSV_RECORD_INCONSISTENT_FIELDS_LENGTH',
      });
    }
    await assert.rejects(parseRecords('id,name\n001,"unterminated'), {
      code: 'CSV_QUOTE_NOT_CLOSED',
    });
    for (const options of [
      { columns: false },
      { raw: true },
      { info: false },
      { cast: true },
      { onRecord: () => null },
      { on_record: () => null },
      { skip_empty_lines: true },
    ]) {
      assert.throws(() => createGtfsCsvParser(options as never), {
        code: 'GTFS_CONFIG_INVALID',
      });
    }
  });

  it('applies caller parse options consistently while retaining object rows', async () => {
    const parser = createGtfsCsvParser({ delimiter: ';', trim: false });
    Readable.from(['first;second\n left ; right \n']).pipe(parser);

    const rows: unknown[] = [];
    for await (const { record: row } of parser) {
      rows.push(row);
    }

    assert.deepEqual(rows, [{ first: ' left ', second: ' right ' }]);
  });
});

describe('GTFS CSV reading', { timeout: 5_000 }, () => {
  it('resolves the agency fallback and imports from the same single CSV read', async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-csv-reader-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const database = new Database(':memory:');
    t.after(() => database.close());
    await writeFile(
      path.join(directory, 'agency.txt'),
      'agency_id,agency_name,agency_url,agency_timezone\nactual,Agency,https://example.com,America/Los_Angeles\n',
    );
    await writeFile(
      path.join(directory, 'routes.txt'),
      'route_id,agency_id,route_type\nroute,,3\n',
    );

    const agencyStreams = new Set<ReadStream>();
    const read = ReadStream.prototype._read;
    const readError = Object.assign(new Error('Agency lookup read failed'), {
      code: 'EIO',
    });
    t.mock.method(
      ReadStream.prototype,
      '_read',
      function (this: ReadStream, size: number) {
        if (path.basename(String(this.path)) === 'agency.txt') {
          agencyStreams.add(this);
          // A second validation, default-ID lookup, or import read must fail.
          if (agencyStreams.size === 2) {
            this.destroy(readError);
            return;
          }
        }
        read.call(this, size);
      },
    );

    const warnings: string[] = [];
    const result = await importGtfs({
      database: { client: database },
      sources: [
        {
          schedule: {
            path: directory,
            defaultAgencyId: 'fallback',
            import: { validation: { mode: 'permissive' } },
          },
        },
      ],
      reporting: {
        level: 'warn',
        reporter: (event) => {
          if (event.type === 'message' && event.level === 'warn') {
            warnings.push(event.message);
          }
        },
      },
    });

    assert.equal(result.success, true);
    assert.equal(agencyStreams.size, 1);
    assert.deepEqual(warnings, [
      '`sources[].schedule.defaultAgencyId` differs from agency.txt; using agency_id "actual"',
    ]);
    assert.deepEqual(database.prepare('SELECT agency_id FROM routes').all(), [
      { agency_id: 'actual' },
    ]);
  });

  it('retains headers, BOM handling, custom options, and multiline records', async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-csv-reader-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, 'agency.txt');
    await writeFile(filePath, '\uFEFFid;name\n1;" first\nsecond "\n');
    let headers: readonly string[] = [];
    const rows = [];
    for await (const batch of readGtfsCsvRecordBatches(
      filePath,
      { delimiter: ';', trim: false },
      (values) => {
        headers = values;
      },
    )) {
      for (const { record: row } of batch) {
        rows.push(row);
      }
    }
    assert.deepEqual(headers, ['id', 'name']);
    assert.deepEqual(rows, [{ id: '1', name: ' first\nsecond ' }]);
  });

  for (const scenario of [
    'complete',
    'consumer failure',
    'parser failure',
    'input failure',
    'batch break',
    'direct normalization failure',
    'staged normalization failure',
  ]) {
    it(`destroys both streams after ${scenario}`, async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-csv-reader-'));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const filePath = path.join(directory, 'agency.txt');
      const header = 'agency_id,agency_name,agency_url,agency_timezone\n';
      const row = '1,Agency,https://example.com,America/Los_Angeles\n';
      await writeFile(
        filePath,
        scenario === 'parser failure'
          ? `${header}1,"unterminated`
          : scenario.endsWith('normalization failure')
            ? `${header}1,,https://example.com,America/Los_Angeles\n`
            : header + row.repeat(5_000),
      );

      const inputs = new Set<ReadStream>();
      const parsers = new Set<Parser>();
      const destroyInput = ReadStream.prototype.destroy;
      const destroyParser = Parser.prototype.destroy;
      t.mock.method(
        ReadStream.prototype,
        'destroy',
        function (this: ReadStream, error?: Error) {
          inputs.add(this);
          return destroyInput.call(this, error);
        },
      );
      t.mock.method(
        Parser.prototype,
        'destroy',
        function (this: Parser, error?: Error) {
          parsers.add(this);
          return destroyParser.call(this, error);
        },
      );

      const consumerError = new Error('Consumer failed');
      const consume = async () => {
        if (scenario === 'batch break') {
          for await (const batch of readGtfsSourceRecordBatches({
            filePath,
            table: compiledTableRegistry.agency,
            csv: {},
            onHeaders() {},
          })) {
            assert.ok(batch.length > 0);
            break;
          }
          return;
        }
        if (scenario.endsWith('normalization failure')) {
          const options = {
            directory,
            tables: [compiledTableRegistry.agency],
            sourceId: 'test',
            mode: 'off' as const,
            onUnknownField: 'preserve' as const,
            onDuplicateKey: 'reject' as const,
          };
          if (scenario === 'staged normalization failure') {
            await collectStagedImportBatches({ ...options, batchSize: 1 });
          } else {
            await importGtfsSourceDirectly({
              options,
              sink: {
                batchSize: 1,
                writeBatch() {
                  assert.fail('An invalid record must not reach the writer');
                },
              },
            });
          }
          return;
        }
        for await (const batch of readGtfsCsvRecordBatches(
          scenario === 'input failure' ? directory : filePath,
          {},
        )) {
          for (const { record } of batch) {
            assert.equal(record.agency_id, '1');
            if (scenario === 'consumer failure') {
              throw consumerError;
            }
          }
        }
      };
      if (scenario === 'consumer failure') {
        await assert.rejects(consume, (error) => error === consumerError);
      } else if (scenario === 'parser failure') {
        await assert.rejects(consume, { code: 'CSV_QUOTE_NOT_CLOSED' });
      } else if (scenario === 'input failure') {
        await assert.rejects(consume, { code: 'EISDIR' });
      } else if (scenario.endsWith('normalization failure')) {
        await assert.rejects(consume, { code: 'GTFS_REQUIRED_VALUE_MISSING' });
      } else {
        await consume();
      }

      assert.equal(inputs.size, 1);
      assert.equal(parsers.size, 1);
      for (const stream of [...inputs, ...parsers]) {
        assert.equal(stream.destroyed, true);
        await finished(stream, { cleanup: true }).catch(() => {});
        assert.equal(stream.closed, true);
      }
    });
  }
});
