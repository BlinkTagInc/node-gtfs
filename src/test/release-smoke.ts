import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const commands = ['gtfs-import', 'gtfs-export', 'gtfsrealtime-update'] as const;

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

function run(
  command: string,
  args: string[],
  cwd: string,
  timeout = 180_000,
): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env:
      workspace === undefined
        ? process.env
        : {
            ...process.env,
            npm_config_cache: path.join(workspace, 'npm-cache'),
          },
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}

function assertSuccess(result: CommandResult, label: string): void {
  assert.equal(
    result.status,
    0,
    `${label} failed${result.error ? `: ${result.error.message}` : ''}\n${result.stdout}${result.stderr}`,
  );
}

let workspace: string;
let projectPath: string;
let feedPath: string;

before(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'gtfs-release-test-'));
  const packagePath = path.join(workspace, 'package');
  projectPath = path.join(workspace, 'project');
  feedPath = path.join(workspace, 'feed');
  await Promise.all([mkdir(packagePath), mkdir(projectPath), mkdir(feedPath)]);

  const packResult = run(
    'npm',
    ['pack', '--json', '--pack-destination', packagePath],
    repositoryRoot,
  );
  assertSuccess(packResult, 'npm pack');
  const packOutput = JSON.parse(packResult.stdout) as
    Array<{ filename: string }> | Record<string, { filename: string }>;
  const packedPackages = Array.isArray(packOutput)
    ? packOutput
    : Object.values(packOutput);
  assert.equal(packedPackages.length, 1);
  const tarballPath = path.join(packagePath, packedPackages[0].filename);

  await writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  const installResult = run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--save-exact',
      tarballPath,
      'gtfs-v4@npm:gtfs@4.20.2',
    ],
    projectPath,
  );
  assertSuccess(installResult, 'tarball installation');

  await Promise.all([
    writeFile(
      path.join(feedPath, 'agency.txt'),
      [
        'agency_id,agency_name,agency_url,agency_timezone',
        'test,Test Transit,https://example.test,America/Los_Angeles',
      ].join('\n'),
    ),
    writeFile(
      path.join(feedPath, 'routes.txt'),
      [
        'route_id,agency_id,route_short_name,route_long_name,route_type',
        'route-1,test,1,Test Route,3',
      ].join('\n'),
    ),
    writeFile(
      path.join(projectPath, 'smoke.mjs'),
      `
        import assert from 'node:assert/strict';
        import { closeDb, getRoutes, importGtfs, openDb } from 'gtfs';
        import { gtfsManifest } from 'gtfs/schema';

        const [feedPath, sqlitePath] = process.argv.slice(2);
        const config = {
          agencies: [{ path: feedPath }],
          sqlitePath,
          logLevel: 'silent',
        };

        await importGtfs(config);
        const routes = getRoutes({}, ['route_id', 'route_short_name']);
        assert.deepEqual(routes, [
          { route_id: 'route-1', route_short_name: '1' },
        ]);
        assert.equal(gtfsManifest.routes.file, 'routes.txt');
        closeDb(openDb(config));
        process.stdout.write(JSON.stringify({ routeCount: routes.length }));
      `,
    ),
    writeFile(
      path.join(projectPath, 'compatibility.mjs'),
      `
        const [packageName, feedPath, sqlitePath] = process.argv.slice(2);
        const gtfs = await import(packageName);
        const config = {
          agencies: [{ path: feedPath }],
          sqlitePath,
          logLevel: 'silent',
          verbose: false,
        };

        await gtfs.importGtfs(config);
        const db = gtfs.openDb(config);
        const quote = (identifier) =>
          '"' + identifier.replaceAll('"', '""') + '"';
        const tableNames = db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .pluck()
          .all();
        const tables = {};

        for (const tableName of tableNames) {
          const columns = db
            .prepare('PRAGMA table_info(' + quote(tableName) + ')')
            .all()
            .map(({ name }) => name)
            .filter((name) => !name.endsWith('_timestamp'));
          const select = columns.map(quote).join(', ');
          tables[tableName] = {
            columns,
            rows: select.length === 0
              ? []
              : db.prepare('SELECT ' + select + ' FROM ' + quote(tableName)).all(),
          };
        }

        const getterSpecs = {
          agencies: ['getAgencies', [['agency_id', 'ASC']]],
          calendars: ['getCalendars', [['service_id', 'ASC']]],
          calendarDates: [
            'getCalendarDates',
            [['service_id', 'ASC'], ['date', 'ASC']],
          ],
          fareAttributes: [
            'getFareAttributes',
            [['fare_id', 'ASC']],
          ],
          fareRules: ['getFareRules', [['fare_id', 'ASC']]],
          routes: ['getRoutes', [['route_id', 'ASC']]],
          shapes: [
            'getShapes',
            [['shape_id', 'ASC'], ['shape_pt_sequence', 'ASC']],
          ],
          stops: ['getStops', [['stop_id', 'ASC']]],
          stopTimes: [
            'getStoptimes',
            [['trip_id', 'ASC'], ['stop_sequence', 'ASC']],
          ],
          trips: ['getTrips', [['trip_id', 'ASC']]],
        };
        const getters = Object.fromEntries(
          Object.entries(getterSpecs).map(
            ([name, [functionName, orderBy]]) => [
              name,
              gtfs[functionName]({}, [], orderBy),
            ],
          ),
        );

        gtfs.closeDb(db);
        process.stdout.write(JSON.stringify({ tables, getters }));
      `,
    ),
  ]);
});

after(async () => {
  if (workspace !== undefined) {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('packed tarball works in an ESM project', () => {
  for (const command of commands) {
    const cliPath = path.join(projectPath, 'node_modules', '.bin', command);
    const result = run(cliPath, ['--help'], projectPath);
    assertSuccess(result, `${command} --help`);
    assert.match(result.stdout, new RegExp(`Usage: ${command}`));
  }

  const databasePath = path.join(workspace, 'smoke.sqlite');
  const smokeResult = run(
    process.execPath,
    [path.join(projectPath, 'smoke.mjs'), feedPath, databasePath],
    projectPath,
  );
  assertSuccess(smokeResult, 'installed package smoke test');
  assert.deepEqual(JSON.parse(smokeResult.stdout), { routeCount: 1 });
});

interface CompatibilityResult {
  tables: Record<
    string,
    { columns: string[]; rows: Array<Record<string, unknown>> }
  >;
  getters: Record<string, Array<Record<string, unknown>>>;
}

function runCompatibilityImport(
  packageName: 'gtfs' | 'gtfs-v4',
): CompatibilityResult {
  const result = run(
    process.execPath,
    [
      path.join(projectPath, 'compatibility.mjs'),
      packageName,
      path.join(repositoryRoot, 'src/test/fixture/caltrain_20160406.zip'),
      path.join(workspace, `${packageName}.sqlite`),
    ],
    projectPath,
  );
  assertSuccess(result, `${packageName} compatibility import`);
  return JSON.parse(result.stdout) as CompatibilityResult;
}

function sortRows(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

function projectRows(rows: Array<Record<string, unknown>>, columns: string[]) {
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, row[column]])),
  );
}

test('candidate preserves 4.20.2 SQLite source data and getter results', () => {
  const baseline = runCompatibilityImport('gtfs-v4');
  const candidate = runCompatibilityImport('gtfs');

  for (const [tableName, baselineTable] of Object.entries(baseline.tables)) {
    const candidateTable = candidate.tables[tableName];
    assert.ok(candidateTable, `Candidate is missing table ${tableName}`);
    assert.deepEqual(
      baselineTable.columns.filter(
        (column) => !candidateTable.columns.includes(column),
      ),
      [],
      `Candidate is missing source columns from ${tableName}`,
    );
    assert.deepEqual(
      sortRows(projectRows(candidateTable.rows, baselineTable.columns)),
      sortRows(baselineTable.rows),
      `Stored source data changed in ${tableName}`,
    );
  }

  for (const [getterName, baselineRows] of Object.entries(baseline.getters)) {
    const candidateRows = candidate.getters[getterName];
    assert.ok(candidateRows, `Candidate is missing getter ${getterName}`);
    const columns = [...new Set(baselineRows.flatMap(Object.keys))];
    assert.deepEqual(
      projectRows(candidateRows, columns),
      baselineRows,
      `Getter result changed for ${getterName}`,
    );
  }
});
