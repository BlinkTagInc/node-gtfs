import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { parse } from 'csv-parse/sync';
import { Gtfs, GtfsErrorCode, isGtfsError } from '../../src/index.ts';

async function prepare(t: TestContext, count: number) {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-export-iteration-'),
  );
  const directory = path.join(temporaryDirectory, 'export');
  const sqlite = new Database(':memory:');
  const gtfs = new Gtfs({
    database: { client: sqlite },
    reporting: { level: 'silent' },
  });
  t.after(async () => {
    await gtfs.close();
    if (sqlite.open) {
      sqlite.close();
    }
    await rm(temporaryDirectory, { recursive: true, force: true });
  });
  await gtfs.schema.recreate();
  sqlite
    .prepare(
      `insert into agency(source_id, agency_id, agency_name, agency_url, agency_timezone, _node_gtfs_key)
    values ('north', 'agency', 'Transit', 'https://example.com', 'Etc/UTC', ?)`,
    )
    .run('f'.repeat(64));
  sqlite
    .prepare(
      `with recursive ids(n) as (select 1 union all select n+1 from ids where n < ?)
    insert into stops(source_id, stop_id, stop_name)
    select 'north', printf('%06d', n), 'Stop' from ids`,
    )
    .run(count);
  return { sqlite, directory, gtfs };
}

function observeStopIteration(t: TestContext, sqlite: Database.Database) {
  const counts = { discovery: 0, records: 0, openIterators: 0 };
  const prepare = sqlite.prepare;
  t.mock.method(
    sqlite,
    'prepare',
    function (this: Database.Database, query: string) {
      const statement = prepare.call(this, query);
      if (query.includes('from "stops"') && !query.includes('limit')) {
        t.mock.method(statement, 'all', () =>
          assert.fail('Export must not materialize the table'),
        );
        const iterate = statement.iterate;
        t.mock.method(
          statement,
          'iterate',
          function* (this: Database.Statement, ...parameters: unknown[]) {
            counts.openIterators += 1;
            try {
              for (const row of Reflect.apply(iterate, this, parameters)) {
                if (query.startsWith('select "_unknown_fields"')) {
                  counts.discovery += 1;
                } else {
                  counts.records += 1;
                }
                yield row;
              }
            } finally {
              counts.openIterators -= 1;
            }
          },
        );
      }
      return statement;
    },
  );
  return counts;
}

for (const adapter of ['native', 'kysely'] as const) {
  test(`${adapter} export skips null extras, discovers late fields, and streams exact rows`, async (t) => {
    const { sqlite, directory } = await prepare(t, 1002);
    sqlite
      .prepare('update stops set _unknown_fields = ? where stop_id = ?')
      .run(
        JSON.stringify({
          late: 'comma, "quote"\n南',
          stop_name: 'must not overwrite',
          'vendor.label': 'literal dot',
          'vendor[0]': 'literal bracket',
          '0': 'numeric header',
        }),
        '001002',
      );
    sqlite.exec(`insert into stops(source_id,stop_id,_unknown_fields)
      values ('south','001002','{"other_source":"hidden"}')`);
    const counts = observeStopIteration(t, sqlite);
    let transformed = 0;
    const portable = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
      plugins: [
        {
          transformQuery: ({ node }) => node,
          async transformResult({ result }) {
            return {
              ...result,
              rows: result.rows.map((row) => {
                if (Object.hasOwn(row, 'stop_id')) {
                  transformed += 1;
                  return { ...row, stop_name: 'Plugin stop' };
                }
                return row;
              }),
            };
          },
        },
      ],
    });
    const gtfs = new Gtfs({
      database: {
        client: adapter === 'native' ? sqlite : portable,
      },
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      const result = await gtfs.export({
        outputDirectory: directory,
        batchSize: 1,
      });
      assert.equal(
        result.files.find(({ filename }) => filename === 'stops.txt')
          ?.recordCount,
        1002,
      );
      const rows = parse(
        await readFile(path.join(directory, 'stops.txt'), 'utf8'),
        { columns: true },
      ) as Record<string, string>[];
      assert.equal(rows.length, 1002);
      assert.equal(rows[0]?.late, '');
      assert.equal(rows.at(-1)?.late, 'comma, "quote"\n南');
      for (const [field, value] of [
        ['vendor.label', 'literal dot'],
        ['vendor[0]', 'literal bracket'],
        ['0', 'numeric header'],
      ] as const) {
        assert.equal(rows[0]?.[field], '');
        assert.equal(rows.at(-1)?.[field], value);
      }
      assert.equal(
        rows.at(-1)?.stop_name,
        adapter === 'native' ? 'Stop' : 'Plugin stop',
      );
      assert.ok(
        rows.every(
          (row) =>
            !Object.hasOwn(row, 'other_source') &&
            !Object.hasOwn(row, '_unknown_fields'),
        ),
      );
      assert.deepEqual(counts, {
        discovery: 1,
        records: 1002,
        openIterators: 0,
      });
      assert.equal(transformed, adapter === 'native' ? 0 : 1002);
      assert.equal(sqlite.open, true);
      sqlite.exec('drop table stops');
    } finally {
      await gtfs.close();
      await portable.destroy();
    }
  });

  test(`${adapter} export aligns omitted agency IDs and exact money with CSV headers`, async (t) => {
    const { sqlite, directory } = await prepare(t, 1);
    sqlite.exec(`
      insert into routes(source_id, route_id, route_short_name, route_type, _unknown_fields)
      values ('north', 'route', 'R', 3, '{"agency_id":"hidden","extra":"last"}');
      insert into fare_attributes(source_id, fare_id, price, currency_type, payment_method)
      values ('north', 'usd', 9223372036854775807, 'USD', 0),
             ('north', 'jpy', 10, 'JPY', 1),
             ('north', 'bhd', 1, 'BHD', 0),
             ('north', 'zero', 0, 'USD', 0);
    `);
    sqlite.defaultSafeIntegers(true);
    const portable = new Kysely({
      dialect: new SqliteDialect({ database: sqlite }),
    });
    const gtfs = new Gtfs({
      database: { client: adapter === 'native' ? sqlite : portable },
      sources: [{ sourceId: 'north' }],
      reporting: { level: 'silent' },
    });
    try {
      await gtfs.export({ outputDirectory: directory });
      const routes = parse(
        await readFile(path.join(directory, 'routes.txt'), 'utf8'),
        { columns: true },
      ) as Record<string, string>[];
      assert.equal(Object.hasOwn(routes[0]!, 'agency_id'), false);
      assert.equal(routes[0]?.route_short_name, 'R');
      assert.equal(routes[0]?.route_type, '3');
      assert.equal(routes[0]?.extra, 'last');
      const fares = parse(
        await readFile(path.join(directory, 'fare_attributes.txt'), 'utf8'),
        { columns: true },
      ) as Record<string, string>[];
      assert.deepEqual(
        Object.fromEntries(
          fares.map((row) => [
            row.fare_id,
            [row.price, row.currency_type, row.payment_method],
          ]),
        ),
        {
          usd: ['92233720368547758.07', 'USD', '0'],
          jpy: ['10', 'JPY', '1'],
          bhd: ['0.001', 'BHD', '0'],
          zero: ['0.00', 'USD', '0'],
        },
      );
      assert.equal(sqlite.open, true);
    } finally {
      await gtfs.close();
      await portable.destroy();
    }
  });
}

test('export with only null unknown fields sends no rows through header discovery', async (t) => {
  const { sqlite, directory, gtfs } = await prepare(t, 20);
  const counts = observeStopIteration(t, sqlite);
  const result = await gtfs.export({ outputDirectory: directory });
  assert.equal(
    result.files.find(({ filename }) => filename === 'stops.txt')?.recordCount,
    20,
  );
  assert.deepEqual(counts, { discovery: 0, records: 20, openIterators: 0 });
  const rows = parse(
    await readFile(path.join(directory, 'stops.txt'), 'utf8'),
    { columns: true },
  ) as Record<string, string>[];
  assert.equal(rows.length, 20);
  assert.ok(rows.every((row) => !Object.hasOwn(row, '_unknown_fields')));
});

test('native export backpressure and destination failure release the cursor and remove incomplete output', async (t) => {
  const { sqlite, directory } = await prepare(t, 100000);
  const counts = observeStopIteration(t, sqlite);
  const gtfs = new Gtfs({
    database: { client: sqlite },
    reporting: {
      reporter(event) {
        if (
          event.type === 'status' &&
          event.phase === 'complete' &&
          event.message.includes('agency.txt')
        ) {
          mkdirSync(path.join(directory, 'stops.txt'));
        }
      },
    },
  });
  try {
    await assert.rejects(
      gtfs.export({ outputDirectory: directory }),
      (error: unknown) =>
        isGtfsError(error) &&
        error.code === GtfsErrorCode.EXPORT_WRITE_FAILED &&
        error.details?.filename === 'stops.txt',
    );
    assert.equal(counts.openIterators, 0);
    assert.equal(existsSync(directory), false);
    assert.ok(
      counts.records < 100000,
      'Do not eagerly read the whole table ahead of a blocked writer',
    );
    sqlite.exec(
      'create index probe_export_cursor on stops(stop_name); drop index probe_export_cursor',
    );
  } finally {
    await gtfs.close();
  }
});

test('native discovery still rejects malformed non-null extras and releases its cursor', async (t) => {
  const { sqlite, directory, gtfs } = await prepare(t, 3);
  // Simulate externally damaged storage; normal schema writes reject malformed JSON.
  sqlite.pragma('ignore_check_constraints = ON');
  sqlite.exec(
    `update stops set _unknown_fields = '[' where stop_id = '000003'`,
  );
  sqlite.pragma('ignore_check_constraints = OFF');
  const counts = observeStopIteration(t, sqlite);
  await assert.rejects(
    gtfs.export({ outputDirectory: directory }),
    (error: unknown) =>
      isGtfsError(error) &&
      error.code === GtfsErrorCode.JSON_INVALID &&
      error.details?.field === '_unknown_fields',
  );
  assert.deepEqual(counts, { discovery: 1, records: 0, openIterators: 0 });
  sqlite.exec('drop table stops');
});
