/**
 * Runs one benchmark scenario in a fresh process. Launched by sqlite.mjs;
 * v4 resolves its package and dependencies from an isolated baseline install.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  canonicalValue,
  createDigest,
  digestRows,
  measure,
  summarize,
} from './metrics.mjs';

const job = JSON.parse(await readFile(process.argv[2], 'utf8'));
const plan = JSON.parse(await readFile(job.planPath, 'utf8'));
const packageRoot =
  job.version === 'v4' ? job.v4PackageRoot : job.currentPackageRoot;
const requirePackage = createRequire(path.join(packageRoot, 'package.json'));
const packageInfo = requirePackage('./package.json');
const v4Reporting =
  packageInfo.version === '4.19.4'
    ? { verbose: false, logFunction() {} }
    : { logLevel: 'silent' };
assert.equal(
  packageInfo.version,
  job.version === 'v4'
    ? (job.expectedBaselineVersion ?? '4.21.0')
    : job.expectedPackageVersion,
);
const startup = await measure(
  () =>
    import(
      pathToFileURL(job.apiPath ?? path.join(packageRoot, 'dist/index.js')).href
    ),
);
const api = startup.value;
const Database = requirePackage('better-sqlite3');
const sqliteInfo = requirePackage('better-sqlite3/package.json');
const originalPragma = Database.prototype.pragma;
const pragmaNames = [
  'journal_mode',
  'synchronous',
  'temp_store',
  'cache_size',
  'foreign_keys',
  'locking_mode',
  'read_uncommitted',
  'page_size',
  'wal_autocheckpoint',
];
const pragmas = (database) =>
  Object.fromEntries(
    pragmaNames.map((name) => [
      name,
      originalPragma.call(database, name, { simple: true }),
    ]),
  );
let database;
const pragmaTransitions = [];
// Observe owned connections without replacing the public import/query paths.
// Only configuration calls are observed; row reads and writes are untouched.
Database.prototype.pragma = function (statement, ...args) {
  const result = originalPragma.call(this, statement, ...args);
  if (this.name === job.databasePath) {
    database = this;
    if (/^(journal_mode|synchronous)\s*=/i.test(statement)) {
      pragmaTransitions.push({ statement, effective: pragmas(this) });
    }
  }
  return result;
};

let gtfs;
const phaseTrace = [];
const reporter = (event) => {
  if (
    job.diagnostics &&
    (event.type === 'status' ||
      event.type === 'operation:start' ||
      event.type === 'operation:complete')
  ) {
    phaseTrace.push({
      atMs: performance.now(),
      type: event.type,
      phase: event.phase,
      message: event.message,
      cpu: process.cpuUsage(),
    });
  }
};
const unsafeBulk =
  job.action === 'import' &&
  (job.durability === 'unsafe-bulk' || job.profile === 'controlled-unsafe');
const opened = await measure(() => {
  if (job.version === 'v4') {
    return api.openDb({ sqlitePath: job.databasePath });
  }
  gtfs = new api.Gtfs({
    database: {
      path: job.databasePath,
      ...(unsafeBulk ? { durability: 'unsafe-bulk' } : {}),
    },
    sources: [
      {
        sourceId: 'benchmark',
        schedule: {
          path: plan.directory,
          import: { validation: { mode: job.validationMode ?? 'off' } },
        },
      },
    ],
    extensions: job.extensions,
    reporting: job.diagnostics
      ? { level: 'info', reporter }
      : { level: 'silent' },
  });
  return gtfs;
});
assert.ok(database?.open, 'Owned database was not observed');
const defaultPragmas = pragmas(database);
if (job.profile !== 'defaults') {
  for (const statement of [
    'journal_mode = WAL',
    'synchronous = FULL',
    'temp_store = MEMORY',
    'cache_size = -256000',
    'foreign_keys = ON',
    'locking_mode = NORMAL',
    'read_uncommitted = OFF',
  ]) {
    database.pragma(statement);
  }
  if (
    job.profile === 'controlled-unsafe' &&
    job.version === 'v4' &&
    job.action === 'import'
  ) {
    database.unsafeMode(true);
    try {
      database.pragma('journal_mode = OFF');
      database.pragma('synchronous = OFF');
    } finally {
      database.unsafeMode(false);
    }
  }
}

const result = {
  version: job.version,
  profile: job.profile,
  validationMode: job.version === 'v5' ? (job.validationMode ?? 'off') : null,
  durability:
    job.version === 'v5' ? (unsafeBulk ? 'unsafe-bulk' : 'safe') : null,
  action: job.action,
  startup: startup.metrics,
  open: opened.metrics,
  packageVersion: packageInfo.version,
  nodeVersion: process.version,
  betterSqlite3Version: sqliteInfo.version,
  sqliteVersion: database.prepare('select sqlite_version() as version').get()
    .version,
  defaultPragmas,
  beforePragmas: pragmas(database),
  pragmaTransitions,
  phaseTrace,
};
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

function tableEvidence() {
  const evidence = {};
  for (const table of plan.tables) {
    const digest = createDigest();
    const fields = Object.keys(table.fields);
    const rows = database
      .prepare(
        `select ${fields.map(quote).join(',')} from ${quote(table.tableName)}`,
      )
      .safeIntegers(true)
      .iterate();
    for (const row of rows) {
      digest.add(
        fields.map((name) =>
          canonicalValue(row[name], table.fields[name], {
            storedMoney: job.version === 'v5',
            currency: row[table.fields[name].monetary?.currencyField],
          }),
        ),
      );
    }
    evidence[table.filename] = digest.result();
    assert.equal(
      evidence[table.filename].count,
      table.recordCount,
      `${table.filename} record count`,
    );
  }
  return evidence;
}

async function exportEvidence(directory) {
  const { parse } = requirePackage('csv-parse');
  const evidence = {};
  for (const table of plan.tables) {
    const filename = path.join(directory, table.filename);
    if (table.recordCount === 0) {
      assert.equal(
        await stat(filename).then(
          () => true,
          (error) => {
            if (error.code !== 'ENOENT') {
              throw error;
            }
            return false;
          },
        ),
        false,
        `${table.filename} should be omitted`,
      );
      evidence[table.filename] = createDigest().result();
      continue;
    }
    const input = createReadStream(filename);
    const parser = parse({ columns: true, bom: true, skip_empty_lines: true });
    input.on('error', (error) => parser.destroy(error));
    input.pipe(parser);
    const digest = createDigest();
    try {
      for await (const row of parser) {
        digest.add(
          Object.entries(table.fields).map(([name, field]) =>
            canonicalValue(row[name], field),
          ),
        );
      }
    } finally {
      input.destroy();
      parser.destroy();
    }
    evidence[table.filename] = digest.result();
  }
  return evidence;
}

function queryOperation(name) {
  const { routeId, tripId } = plan.probe;
  const tripFields = ['trip_id', 'route_id', 'service_id', 'shape_id'];
  const stopTimeFields = [
    'trip_id',
    'stop_id',
    'stop_sequence',
    'arrival_time',
    'departure_time',
  ];
  const stopFields = ['stop_id', 'stop_name', 'stop_lat', 'stop_lon'];
  if (job.version === 'v4') {
    const options = { db: database };
    const trips = () =>
      api.getTrips(
        { route_id: routeId },
        tripFields,
        [['trip_id', 'ASC']],
        options,
      );
    const operations = {
      tripsByRoute: [tripFields, trips],
      tripsStream: [tripFields, trips],
      tripLookup: [
        tripFields,
        () => api.getTrips({ trip_id: tripId }, tripFields, [], options),
      ],
      tripCount: [
        ['count'],
        () => [
          {
            count: api.getTrips({ route_id: routeId }, ['trip_id'], [], options)
              .length,
          },
        ],
      ],
      tripPage: [tripFields, () => trips().slice(10, 30)],
      stopTimesByTrip: [
        stopTimeFields,
        () =>
          api.getStoptimes(
            { trip_id: tripId },
            stopTimeFields,
            [['stop_sequence', 'ASC']],
            options,
          ),
      ],
      stopsByRoute: [
        stopFields,
        () => api.getStops({ route_id: routeId }, stopFields, [], options),
      ],
    };
    return operations[name];
  }
  const trips = () =>
    gtfs.schedule.trips
      .where({ route_id: routeId })
      .select(...tripFields)
      .orderBy([{ field: 'trip_id', direction: 'asc' }]);
  const operations = {
    tripsByRoute: [tripFields, () => trips().all()],
    tripsStream: [
      tripFields,
      async () => {
        const rows = [];
        for await (const row of trips().stream()) {
          rows.push(row);
        }
        return rows;
      },
    ],
    tripLookup: [
      tripFields,
      () =>
        gtfs.schedule.trips
          .where({ trip_id: tripId })
          .select(...tripFields)
          .all(),
    ],
    tripCount: [
      ['count'],
      async () => [
        {
          count: await gtfs.schedule.trips.where({ route_id: routeId }).count(),
        },
      ],
    ],
    tripPage: [tripFields, () => trips().offset(10).limit(20).all()],
    stopTimesByTrip: [
      stopTimeFields,
      () =>
        gtfs.schedule.stopTimes
          .where({ trip_id: tripId })
          .select(...stopTimeFields)
          .orderBy([{ field: 'stop_sequence', direction: 'asc' }])
          .all(),
    ],
    stopsByRoute: [
      stopFields,
      () =>
        gtfs.query
          .stopsForRoute({ routeId })
          .select(...stopFields)
          .all(),
    ],
  };
  return operations[name];
}

async function fileSizes() {
  return Object.fromEntries(
    await Promise.all(
      ['', '-wal', '-shm', '-journal'].map(async (suffix) => [
        suffix || 'database',
        await stat(job.databasePath + suffix).then(
          (info) => info.size,
          (error) => {
            if (error.code !== 'ENOENT') {
              throw error;
            }
            return 0;
          },
        ),
      ]),
    ),
  );
}

try {
  if (job.action === 'import') {
    const imported = await measure(() =>
      job.version === 'v4'
        ? api.importGtfs({
            sqlitePath: job.databasePath,
            agencies: [{ path: plan.directory }],
            ...v4Reporting,
          })
        : gtfs.import(),
    );
    if (job.version === 'v5') {
      assert.equal(imported.value.success, true);
      result.validation = imported.value.validation;
    }
    result.metrics = imported.metrics;
    if (job.reimport) {
      assert.equal(job.version, 'v5');
      const replaced = await measure(() => gtfs.import());
      assert.equal(replaced.value.success, true);
      assert.deepEqual(replaced.value.validation, imported.value.validation);
      result.reimportMetrics = replaced.metrics;
    }
    result.evidence = tableEvidence();
    result.tableCount = database
      .prepare(
        "select count(*) as count from sqlite_master where type = 'table'",
      )
      .get().count;
    result.indexCount = database
      .prepare(
        "select count(*) as count from sqlite_master where type = 'index'",
      )
      .get().count;
  } else if (job.action === 'export') {
    const exported = await measure(() =>
      job.version === 'v4'
        ? api.exportGtfs({
            sqlitePath: job.databasePath,
            exportPath: job.outputDirectory,
            ...v4Reporting,
          })
        : gtfs.export({ outputDirectory: job.outputDirectory }),
    );
    result.metrics = exported.metrics;
    result.evidence = await exportEvidence(job.outputDirectory);
  } else if (job.action === 'query') {
    const [fields, operation] = queryOperation(job.query);
    const cold = await measure(operation);
    result.evidence = digestRows(cold.value, fields);
    result.firstQuery = cold.metrics;
    for (let index = 0; index < job.queryWarmups; index += 1) {
      await operation();
    }
    const samples = [];
    for (let index = 0; index < job.queryRepetitions; index += 1) {
      const sample = await measure(operation);
      assert.deepEqual(digestRows(sample.value, fields), result.evidence);
      samples.push(sample.metrics);
    }
    result.samples = samples;
    result.metrics = {
      ...samples.at(-1),
      durationMs: summarize(samples.map(({ durationMs }) => durationMs)).median,
    };
  } else {
    throw new Error(`Unknown benchmark action ${job.action}`);
  }
  result.recordCount =
    job.action === 'import' || job.action === 'export'
      ? Object.values(result.evidence).reduce(
          (count, table) => count + table.count,
          0,
        )
      : job.action === 'query'
        ? result.evidence.count
        : result.evidence.features;
  result.recordsPerSecond =
    result.recordCount / (result.metrics.durationMs / 1000);
  result.afterPragmas = pragmas(database);
  result.beforeCloseBytes = await fileSizes();
} finally {
  const closed = await measure(() =>
    job.version === 'v4' ? api.closeDb(database) : gtfs.close(),
  );
  result.close = closed.metrics;
  result.afterCloseBytes = await fileSizes();
  Database.prototype.pragma = originalPragma;
}
process.stdout.write(JSON.stringify(result));
