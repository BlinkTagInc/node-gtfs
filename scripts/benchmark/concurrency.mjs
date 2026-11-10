/** Manual baseline on disposable databases; no timing assertions or CI budgets. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { cpus } from 'node:os';
import Database from 'better-sqlite3';
import { Kysely, MysqlDialect, PostgresDialect, sql } from 'kysely';
import mysql from 'mysql2';
import pg from 'pg';
import Cursor from 'pg-cursor';
import { Gtfs } from '../../dist/index.js';
import { digestRows, measure, summarize } from './metrics.mjs';

const { values } = parseArgs({
  options: {
    backend: { type: 'string', default: 'sqlite' },
    'disposable-database': { type: 'boolean', default: false },
    output: { type: 'string', default: 'internal/benchmarks' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(
    'node scripts/benchmark/concurrency.mjs --backend sqlite|postgres|mysql [--disposable-database] [--output internal/benchmarks]',
  );
  process.exit(0);
}
assert.ok(['sqlite', 'postgres', 'mysql'].includes(values.backend));
assert.ok(
  values.backend === 'sqlite' || values['disposable-database'],
  'Server benchmarks recreate managed tables. Supply --disposable-database with a dedicated GTFS_BENCH_POSTGRES_URL or GTFS_BENCH_MYSQL_URL.',
);
const root = path.resolve(import.meta.dirname, '../..');
const hash = async (filename) =>
  createHash('sha256')
    .update(await readFile(filename))
    .digest('hex');
const build = {};
for (const filename of (
  await readdir(path.join(root, 'dist'), { recursive: true })
).sort()) {
  if (filename.endsWith('.js')) {
    build[filename] = await hash(path.join(root, 'dist', filename));
  }
}
await mkdir(values.output, { recursive: true });
const output = await mkdtemp(
  path.join(values.output, `concurrency-${values.backend}-`),
);
const poolSize = 4;
let client;
let gtfs;
const report = {
  backend: values.backend,
  node: process.version,
  cpu: cpus()[0]?.model,
  gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  build,
  harnessSha256: await hash(import.meta.filename),
  lockSha256: await hash(path.join(root, 'pnpm-lock.yaml')),
  settings: {
    poolSize: values.backend === 'sqlite' ? 1 : poolSize,
    rows: 10000,
    pageSize: 500,
    operations: 24,
    warmups: 1,
    repetitions: 3,
    sourceId: 'benchmark',
  },
  samples: [],
};
const watchdog = setTimeout(() => {
  report.error = 'Benchmark exceeded 120000 ms';
  writeFile(
    path.join(output, 'results.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  ).finally(() => process.exit(1));
}, 120000);
const rows = Array.from({ length: report.settings.rows }, (_, index) => ({
  source_id: 'benchmark',
  route_id: String(index).padStart(5, '0'),
  route_type: 3,
}));
const fields = ['route_id', 'route_type'];
const expected = digestRows(rows.slice(0, report.settings.pageSize), fields);
try {
  if (values.backend === 'sqlite') {
    client = new Database(path.join(output, 'transit.sqlite'));
    report.pragmas = Object.fromEntries(
      ['journal_mode', 'synchronous', 'cache_size', 'temp_store'].map(
        (name) => [name, client.pragma(name, { simple: true })],
      ),
    );
    gtfs = new Gtfs({
      database: { client },
      sources: [{ sourceId: 'benchmark' }],
      extensions: [],
      reporting: { level: 'silent' },
    });
  } else {
    const url =
      process.env[
        values.backend === 'postgres'
          ? 'GTFS_BENCH_POSTGRES_URL'
          : 'GTFS_BENCH_MYSQL_URL'
      ];
    assert.ok(url, 'Missing dedicated benchmark database URL');
    client = new Kysely({
      dialect:
        values.backend === 'postgres'
          ? new PostgresDialect({
              pool: new pg.Pool({ connectionString: url, max: poolSize }),
              cursor: Cursor,
            })
          : new MysqlDialect({
              pool: mysql.createPool({ uri: url, connectionLimit: poolSize }),
            }),
    });
    gtfs = new Gtfs({
      database: { client },
      sources: [{ sourceId: 'benchmark' }],
      extensions: [],
      reporting: { level: 'silent' },
    });
  }
  await gtfs.schema.recreate();
  await gtfs.database.withKysely({
    callback: async (db) => {
      for (let index = 0; index < rows.length; index += 500) {
        await db
          .insertInto('routes')
          .values(rows.slice(index, index + 500))
          .execute();
      }
      report.databaseVersion = (
        await (
          values.backend === 'sqlite'
            ? sql`select sqlite_version() as version`
            : sql`select version() as version`
        ).execute(db)
      ).rows;
    },
  });
  const query = () =>
    gtfs.schedule.routes
      .select(...fields)
      .orderBy([{ field: 'route_id' }])
      .limit(report.settings.pageSize);
  const read = async (index) => {
    if (index % 2 === 0) {
      return query().all();
    }
    const result = [];
    for await (const row of query().stream()) {
      result.push(row);
    }
    return result;
  };
  for (let round = -1; round < report.settings.repetitions; round += 1) {
    for (const mode of round % 2 === 0
      ? ['concurrent', 'serial']
      : ['serial', 'concurrent']) {
      const sample = await measure(async () => {
        if (mode === 'concurrent' && values.backend !== 'sqlite') {
          return Promise.all(
            Array.from({ length: report.settings.operations }, (_, index) =>
              read(index),
            ),
          );
        }
        // SQLite rejects overlapping streams. Its public policy requires serial consumption.
        const results = [];
        for (let index = 0; index < report.settings.operations; index += 1) {
          results.push(await read(index));
        }
        return results;
      });
      for (const result of sample.value) {
        assert.deepEqual(digestRows(result, fields), expected);
      }
      report.samples.push({
        round,
        mode:
          values.backend === 'sqlite' && mode === 'concurrent'
            ? 'serial-stream-policy'
            : mode,
        ...sample.metrics,
      });
    }
  }
  // A queued exclusive callback must finish after the preceding array reads;
  // close must drain both before allowing the borrowed client to be destroyed.
  const drained = await measure(async () => {
    const reads = Array.from({ length: report.settings.operations }, () =>
      query().all(),
    );
    const exclusiveStart = performance.now();
    const exclusive = gtfs.database.withKysely({
      callback: async (db) => {
        const count = await db
          .selectFrom('routes')
          .where('source_id', '=', 'benchmark')
          .select(sql`count(*)`.as('count'))
          .executeTakeFirstOrThrow();
        assert.equal(Number(count.count), rows.length);
        report.exclusiveQueueAndQueryMs = performance.now() - exclusiveStart;
      },
    });
    const closeStart = performance.now();
    await gtfs.close();
    report.closeDrainMs = performance.now() - closeStart;
    await exclusive;
    return Promise.all(reads);
  });
  for (const result of drained.value) {
    assert.deepEqual(digestRows(result, fields), expected);
  }
  report.drain = drained.metrics;
  report.evidence = expected;
  report.summary = Object.fromEntries(
    [...new Set(report.samples.map(({ mode }) => mode))].map((mode) => [
      mode,
      summarize(
        report.samples
          .filter((sample) => sample.mode === mode && sample.round >= 0)
          .map(({ durationMs }) => durationMs),
      ),
    ]),
  );
  report.success = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await gtfs?.close();
  if (client instanceof Database) {
    client.close();
  } else {
    await client?.destroy();
  }
  await writeFile(
    path.join(output, 'results.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  clearTimeout(watchdog);
  console.log(`Results: ${output}`);
}
