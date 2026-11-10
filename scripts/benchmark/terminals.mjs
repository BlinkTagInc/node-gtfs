/** One fresh-process, read-only terminal experiment on a prepared SQLite feed. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import Database from 'better-sqlite3';
import { measure, summarize } from './metrics.mjs';

const { values } = parseArgs({
  options: {
    database: { type: 'string' },
    operation: { type: 'string', default: 'array' },
    source: { type: 'string', default: 'benchmark' },
    api: {
      type: 'string',
      default: path.resolve(import.meta.dirname, '../../dist/index.js'),
    },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(
    'node scripts/benchmark/terminals.mjs --database /path/to/benchmark.sqlite --operation array|stream|early|first [--source benchmark] [--api /path/to/frozen/dist/index.js]',
  );
  process.exit(0);
}
assert.ok(values.database, 'A prepared benchmark database is required');
assert.ok(['array', 'stream', 'early', 'first'].includes(values.operation));
async function sha256(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}
const databaseSha256 = await sha256(values.database);
const build = {};
const buildDirectory = path.dirname(path.resolve(values.api));
for (const filename of (
  await readdir(buildDirectory, { recursive: true })
).sort()) {
  if (filename.endsWith('.js')) {
    build[filename] = await sha256(path.join(buildDirectory, filename));
  }
}
const { Gtfs } = await import(pathToFileURL(path.resolve(values.api)).href);
const database = new Database(values.database, {
  readonly: true,
  fileMustExist: true,
});
for (const pragma of [
  'synchronous=FULL',
  'cache_size=-256000',
  'temp_store=MEMORY',
  'foreign_keys=ON',
]) {
  database.pragma(pragma);
}
const gtfs = new Gtfs({
  database: { client: database },
  sources: [{ sourceId: values.source }],
  extensions: [],
  reporting: { level: 'silent' },
});
const query = () =>
  gtfs.schedule.stopTimes
    .select('trip_id', 'stop_sequence', 'arrival_time')
    .orderBy([{ field: 'trip_id' }, { field: 'stop_sequence' }])
    .limit(100000);
const report = {
  node: process.version,
  databaseSha256,
  build,
  database: path.resolve(values.database),
  api: path.resolve(values.api),
  operation: values.operation,
  sourceId: values.source,
  warmups: 1,
  repetitions: 3,
  limit: 100000,
  samples: [],
  harnessSha256: createHash('sha256')
    .update(await readFile(import.meta.filename))
    .digest('hex'),
};
try {
  // Independent array reference outside timing; a separate process for each
  // terminal keeps memory observations from earlier methods out of later ones.
  // For stream memory, compute the reference through a raw incremental cursor.
  const reference = createHash('sha256');
  let referenceCount = 0;
  const count =
    values.operation === 'early'
      ? 10
      : values.operation === 'first'
        ? 1
        : 100000;
  for (const row of database
    .prepare(
      'select trip_id, stop_sequence, arrival_time from stop_times where source_id = ? order by trip_id, stop_sequence limit ?',
    )
    .iterate(values.source, count)) {
    reference.update(JSON.stringify(row));
    reference.update('\n');
    referenceCount += 1;
  }
  report.evidence = { count: referenceCount, sha256: reference.digest('hex') };
  for (let round = -1; round < report.repetitions; round += 1) {
    const sample = await measure(async () => {
      const hash = createHash('sha256');
      let consumed = 0;
      const add = (row) => {
        hash.update(JSON.stringify(row));
        hash.update('\n');
        consumed += 1;
      };
      if (values.operation === 'array') {
        for (const row of await query().all()) {
          add(row);
        }
      } else if (values.operation === 'first') {
        const row = await query().firstOrThrow();
        add(row);
      } else {
        for await (const row of query().stream()) {
          add(row);
          if (values.operation === 'early' && consumed === 10) {
            break;
          }
        }
      }
      // Same cleanup probe for every terminal, including early stream return.
      assert.ok(await gtfs.schedule.trips.first());
      return { count: consumed, sha256: hash.digest('hex') };
    });
    assert.deepEqual(sample.value, report.evidence);
    report.samples.push({ round, ...sample.metrics });
  }
  report.durationMs = summarize(
    report.samples
      .filter(({ round }) => round >= 0)
      .map(({ durationMs }) => durationMs),
  );
} finally {
  await gtfs.close();
  database.close();
}
console.log(JSON.stringify(report, null, 2));
