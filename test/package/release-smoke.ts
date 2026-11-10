import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const commands = [
  [],
  ['import'],
  ['export'],
  ['realtime'],
  ['realtime', 'refresh'],
] as const;
interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}
let workspace: string;
let projectPath: string;
let feedPath: string;
let documentationTypeFiles: string[];
async function installPackedPackage(packageArchive: string): Promise<void> {
  const nodeModules = path.join(projectPath, 'node_modules');
  await mkdir(nodeModules);
  const extractResult = run(
    'tar',
    ['-xzf', packageArchive, '-C', nodeModules],
    repositoryRoot,
  );
  assertSuccess(extractResult, 'tarball extraction');
  const installedPackagePath = path.join(nodeModules, 'gtfs');
  await rename(path.join(nodeModules, 'package'), installedPackagePath);
  assert.equal(
    existsSync(path.join(installedPackagePath, 'config-sample-realtime.json')),
    true,
  );
  const packedManifest = JSON.parse(
    await readFile(path.join(installedPackagePath, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
    bin?: Record<string, string>;
  };
  assert.deepEqual(packedManifest.bin, { gtfs: 'dist/bin/gtfs.js' });
  for (const dependency of new Set([
    ...Object.keys(packedManifest.dependencies ?? {}),
    'pg',
    'pg-cursor',
    'mysql2',
    '@types/node',
    '@types/pg',
    '@types/pg-cursor',
    '@types/better-sqlite3',
  ])) {
    const dependencyParts = dependency.split('/');
    const target = path.join(
      repositoryRoot,
      'node_modules',
      ...dependencyParts,
    );
    assert.equal(
      existsSync(target),
      true,
      `Local dependency ${dependency} is unavailable for the package smoke test`,
    );
    const link = path.join(nodeModules, ...dependencyParts);
    await mkdir(path.dirname(link), { recursive: true });
    await symlink(target, link, 'dir');
  }
  const binDirectory = path.join(nodeModules, '.bin');
  await mkdir(binDirectory);
  for (const [name, executable] of Object.entries(packedManifest.bin ?? {})) {
    await symlink(
      path.join('..', 'gtfs', executable),
      path.join(binDirectory, name),
    );
  }
}
function run(command: string, args: string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
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
before(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'gtfs-release-test-'));
  const packagePath = path.join(workspace, 'package');
  projectPath = path.join(workspace, 'project');
  feedPath = path.join(workspace, 'feed');
  await Promise.all([mkdir(packagePath), mkdir(projectPath), mkdir(feedPath)]);
  const packResult = run(
    'npm',
    [
      'pack',
      '--json',
      '--cache',
      path.join(workspace, 'npm-cache'),
      '--pack-destination',
      packagePath,
    ],
    repositoryRoot,
  );
  assertSuccess(packResult, 'npm pack');
  const packedPackages = (await readdir(packagePath)).filter((filename) =>
    filename.endsWith('.tgz'),
  );
  assert.equal(packedPackages.length, 1);
  await writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await installPackedPackage(
    path.join(packagePath, packedPackages[0] as string),
  );
  const migrationExamples = run(
    process.execPath,
    [
      '--disable-warning=ExperimentalWarning',
      path.join(repositoryRoot, 'scripts/check-migration.mjs'),
      '--package-directory',
      path.join(projectPath, 'node_modules/gtfs'),
      '--examples-directory',
      projectPath,
    ],
    repositoryRoot,
  );
  assertSuccess(migrationExamples, 'extract published migration examples');
  const documentationExamples = run(
    process.execPath,
    [
      path.join(repositoryRoot, 'scripts/extract-doc-examples.mjs'),
      '--package-directory',
      path.join(projectPath, 'node_modules/gtfs'),
      '--examples-directory',
      projectPath,
    ],
    repositoryRoot,
  );
  assertSuccess(
    documentationExamples,
    'extract published documentation examples',
  );
  documentationTypeFiles = (await readdir(projectPath))
    .filter(
      (filename) =>
        filename.startsWith('documentation-') ||
        (filename.startsWith('migration-') && filename.endsWith('.mts')),
    )
    .map((filename) => path.join(projectPath, filename));
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
        import { Gtfs, importGtfs, exportGtfs } from 'gtfs';
        import { gtfsManifest, routes as routesTable } from 'gtfs/schema';
        import { openSqliteDatabase, inspectSqliteGtfsSchema } from 'gtfs/sqlite';
        import {
          inspectKyselyGtfsSchema,
        } from 'gtfs/kysely';

        assert.equal(typeof openSqliteDatabase, 'function');
        assert.equal(typeof inspectSqliteGtfsSchema, 'function');
        assert.equal(typeof importGtfs, 'function');
        assert.equal(typeof exportGtfs, 'function');
        assert.equal(typeof inspectKyselyGtfsSchema, 'function');

        const [feedPath, databasePath] = process.argv.slice(2);
        await importGtfs({
          database: { path: databasePath },
          sources: [{
            sourceId: 'test',
            schedule: {
              path: feedPath,
              import: { validation: { mode: 'permissive', onUnknownField: 'discard' } },
            },
          }],
          reporting: { level: 'silent' },
        });
        const gtfs = new Gtfs({
          database: { path: databasePath },
          sources: [{ sourceId: 'test' }],
          reporting: { level: 'silent' },
        });
        assert.equal((await gtfs.import({ sources: [{ sourceId: 'test', schedule: { path: feedPath } }], validation: { mode: 'off' } })).success, true);
        assert.equal((await gtfs.export({ sourceId: 'test', outputDirectory: databasePath + '.instance-export' })).sourceId, 'test');
        assert.equal(gtfs.database.dialect, 'sqlite');
        assert.equal(gtfs.database.ownership, 'owned');
        assert.equal(typeof gtfs.database.withKysely, 'function');
        assert.equal(gtfs.schema.tables.routes.filename, 'routes.txt');
        assert.equal(typeof gtfs.schema.ensure, 'function');
        assert.equal(typeof gtfs.schema.validate, 'function');
        assert.equal(typeof gtfs.schema.recreate, 'function');
        assert.equal(gtfs.reporting.level, 'silent');
        assert.equal(typeof gtfs.reporting.log, 'function');
        assert.equal((await gtfs.schema.validate()).compatible, true);
        const routeCount = await gtfs.database.withKysely({
          callback: (database) =>
            database.selectFrom('routes').select('route_id').execute(),
        });
        assert.equal(routeCount.length, 1);
        gtfs.reporting.log({ level: 'info', message: 'silent' });
        const routes = await gtfs.schedule.routes.select('route_id', 'route_short_name').all();
        assert.deepEqual(routes, [
          { route_id: 'route-1', route_short_name: '1' },
        ]);
        assert.equal(await gtfs.schedule.routes.select('route_id').count(), 1);
        await assert.rejects(async () => gtfs.schedule.routes
          .where(() => { assert.fail('Reader callbacks must not run'); }).count(),
          { code: 'GTFS_QUERY_INVALID' });
        const withoutTrips = await gtfs.database.withKysely({
          callback: database => database.selectFrom('routes').select('route_id')
            .where('source_id', '=', 'test')
            .where(eb => eb.not(eb.exists(
              eb.selectFrom('trips').select('trip_id')
                .whereRef('trips.source_id', '=', 'routes.source_id')
                .whereRef('trips.route_id', '=', 'routes.route_id')
            )))
            .execute(),
        });
        assert.deepEqual(withoutTrips, [{ route_id: 'route-1' }]);
        const summaries = await gtfs.database.withKysely({
          callback: database => database.selectFrom('routes')
            .where('source_id', '=', 'test')
            .whereRef('route_id', '=', 'route_id')
            .select(['source_id', 'route_type'])
            .select(eb => [eb.fn.countAll().as('total'), eb.fn.min('route_short_name').as('firstName'),
              eb.fn.sum('route_type').as('sum'), eb.fn.avg('route_type').as('average')])
            .groupBy(['source_id', 'route_type']).execute(),
        });
        assert.deepEqual(summaries, [{ source_id: 'test', route_type: 3, total: 1, firstName: '1', sum: 3, average: 3 }]);
        const reader = gtfs.schedule.routes.orderBy([{ field: 'route_id' }]).select('route_id', 'route_short_name');
        const pending = reader.all();
        assert.equal(pending instanceof Promise, true);
        assert.deepEqual(await pending, routes);
        assert.deepEqual(await reader.firstOrThrow(), routes[0]);
        const result = reader.stream();
        assert.equal('then' in result, false);
        const iterated = [];
        for await (const route of result) {
          iterated.push(route);
        }
        assert.deepEqual(iterated, routes);
        assert.equal(gtfsManifest.routes.filename, 'routes.txt');
        assert.equal(gtfsManifest.routes.tableName, 'routes');
        assert.equal(gtfsManifest.routes.specification, 'gtfs-schedule');
        assert.equal(routesTable.filename, 'routes.txt');
        assert.equal(routesTable.tableName, 'routes');
        assert.equal(routesTable.specification, 'gtfs-schedule');
        await gtfs.close();
        assert.equal(gtfs.isClosed, true);
        process.stdout.write(JSON.stringify({ routeCount: routes.length }));
      `,
    ),
    writeFile(
      path.join(projectPath, 'smoke.ts'),
      `
        import {
          Gtfs,
          refreshGtfsRealtime,
          type GtfsCsvParseOptions,
          type GtfsJsonConfig,
          type GtfsInstanceOptions,
          type GtfsRealtimeRefreshOptions,
          type GtfsDatabaseAccess,
          type GtfsSchema,
          type GtfsReporting,
          type StopTimes,
          type Calendar,
          type BoardAlight,
          type GtfsStoredTableRow,
          createConsoleReporter,
          type GtfsReporter,
          type GtfsReportEvent,
          type GtfsReportedError,
          type GtfsOperationName,
          type GtfsConsoleReporterOptions,
          type GtfsReportingLevel,
          type GtfsLogMessageLevel,
          type GtfsReportingConfig,
          type GtfsConfigIssue,
          type GtfsCsvSourcePosition,
          type GtfsGeoJSONSourcePosition,
          type GtfsRealtimeSourcePosition,
          type GtfsSourcePosition,
          type GtfsErrorDetails,
          type GtfsValidationNoticeDetails,
          isGtfsError,
        } from 'gtfs';
        import { importGtfs, exportGtfs, type GtfsImportOptions, type GtfsExportOptions, type GtfsExportResult, type GtfsExportFileResult } from 'gtfs';
        import { gtfsManifest, type Routes } from 'gtfs/schema';
        import { openSqliteDatabase, inspectSqliteGtfsSchema, type GtfsSchemaInspection } from 'gtfs/sqlite';
        import {
          cleanupGtfsRealtime,
          inspectKyselyGtfsSchema,
        } from 'gtfs/kysely';

        void Gtfs;
        void importGtfs;
        void gtfsManifest;
        void openSqliteDatabase;
        void exportGtfs;
        type PublicTypes =
          | GtfsImportOptions
          | Routes
          | GtfsSchemaInspection
          | GtfsExportOptions;
        void (null as unknown as PublicTypes);

        declare const caught: unknown;
        if (isGtfsError(caught)) {
          const details: GtfsErrorDetails | undefined = caught.details;
          const issues: readonly GtfsConfigIssue[] = details?.errors ?? [];
          const positions: readonly GtfsSourcePosition[] = caught.positions ?? [];
          for (const position of positions) {
            if (position.kind === 'csv') {
              const csv: GtfsCsvSourcePosition = position;
              const line: number = csv.csvLineNumber;
              void line;
            } else if (position.kind === 'geojson') {
              const geojson: GtfsGeoJSONSourcePosition = position;
              const feature: number = geojson.featureNumber;
              void feature;
            } else {
              const realtime: GtfsRealtimeSourcePosition = position;
              const entity: number = realtime.entityNumber;
              void entity;
            }
          }
          void issues;
        }
        declare const diagnosticEvent: GtfsReportEvent;
        if (diagnosticEvent.type === 'message') {
          const issues: readonly GtfsConfigIssue[] = diagnosticEvent.error?.details?.errors ?? [];
          void issues;
        } else if (diagnosticEvent.type === 'validation:notice') {
          const details: GtfsValidationNoticeDetails | undefined = diagnosticEvent.notice.details;
          const position: GtfsSourcePosition | undefined = diagnosticEvent.notice.position;
          const firstPosition: GtfsSourcePosition | undefined = diagnosticEvent.notice.firstPosition;
          void details;
          void firstPosition;
          void position;
        }

        declare const sqliteClient: Parameters<typeof inspectSqliteGtfsSchema>[0]['database'];
        declare const kyselyClient: Parameters<typeof inspectKyselyGtfsSchema>[0]['database'];
        void inspectSqliteGtfsSchema({ database: sqliteClient, includeIndexes: true });
        void inspectKyselyGtfsSchema({ database: kyselyClient, dialect: 'postgres', extensions: [] });
        void cleanupGtfsRealtime({ database: kyselyClient, extensions: ['gtfs-realtime'] });
        // @ts-expect-error Public inspectors require a named options object.
        void inspectSqliteGtfsSchema(sqliteClient, {});
        // @ts-expect-error Public inspectors require a named options object.
        void inspectKyselyGtfsSchema(kyselyClient, { dialect: 'postgres' });
        // @ts-expect-error Low-level cleanup requires a named options object.
        void cleanupGtfsRealtime(kyselyClient, { extensions: ['gtfs-realtime'] });
        // @ts-expect-error Public inspectors do not accept table subsets.
        void inspectSqliteGtfsSchema({ database: sqliteClient, tables: [] });
        // @ts-expect-error Public inspectors do not accept table subsets.
        void inspectKyselyGtfsSchema({ database: kyselyClient, dialect: 'postgres', tables: [] });

        const csvParseOptions: GtfsCsvParseOptions = {
          encoding: 'utf8', delimiter: ';', quote: false,
          escape: '"', trim: false, skipEmptyLines: true, relaxQuotes: false,
        };
        const csvImport = {
          database: { path: ':memory:' },
          sources: [{ schedule: { path: './feed.zip', import: { csv: csvParseOptions } } }],
        } as const;
        const csvJson: GtfsJsonConfig = csvImport;
        void csvJson;
        void importGtfs(csvImport);
        // @ts-expect-error CSV option aliases are not supported.
        const csvAlias: GtfsCsvParseOptions = { skip_empty_lines: true };
        // @ts-expect-error CSV callbacks are not supported.
        const csvCallback: GtfsCsvParseOptions = { on_record: () => null };
        void csvAlias;
        void csvCallback;

        const importExtensions: GtfsImportOptions['extensions'] = 'auto';
        const explicitExtensions = ['gtfs-realtime'] as const;
        const instanceExtensions: GtfsInstanceOptions['extensions'] = explicitExtensions;
        const exportExtensions: GtfsExportOptions['extensions'] = explicitExtensions;
        const refreshExtensions: GtfsRealtimeRefreshOptions['extensions'] = explicitExtensions;
        void [importExtensions, instanceExtensions, exportExtensions, refreshExtensions];
        const autoConfig = {
          database: { path: ':memory:' },
          extensions: 'auto',
          sources: [{
            schedule: { path: './feed.zip' },
            realtime: { feeds: [{ type: 'alerts', url: 'https://example.test/alerts.pb' }] },
          }],
        } as const;
        void importGtfs(autoConfig);
        // @ts-expect-error Auto-detection is only available during Schedule import.
        new Gtfs(autoConfig);
        // @ts-expect-error Export requires explicit extensions.
        void exportGtfs(autoConfig);
        // @ts-expect-error Realtime refresh requires explicit extensions.
        void refreshGtfsRealtime(autoConfig);
        declare const kyselyDatabase: import('kysely').Kysely<import('gtfs/schema').GtfsDatabase>;
        void importGtfs({ ...autoConfig, database: { client: kyselyDatabase } });
        // @ts-expect-error Kysely export requires explicit extensions.
        void exportGtfs({ database: { client: kyselyDatabase }, extensions: 'auto' });

        const events: GtfsReportEvent[] = [];
        const reporter: GtfsReporter = (event) => {
          events.push(event);
        };
        const level: GtfsReportingLevel = 'info';
        const reporting: GtfsReportingConfig = { level, reporter };
        const consoleOptions: GtfsConsoleReporterOptions = { animateProgress: false };
        const consoleReporter: GtfsReporter = createConsoleReporter(consoleOptions);
        const messageLevel: GtfsLogMessageLevel = 'warn';
        const operation: GtfsOperationName = 'import';
        const error: GtfsReportedError = { name: 'Error', message: 'example' };
        void reporting;
        void consoleReporter;
        void messageLevel;
        void operation;
        void error;

        declare const gtfs: Gtfs;
        const instanceExport: Promise<GtfsExportResult> = gtfs.export();
        const standaloneExport: Promise<GtfsExportResult> = exportGtfs({ database: { path: './gtfs.sqlite' } });
        const exported: GtfsExportResult = await instanceExport;
        const exportedFiles: readonly GtfsExportFileResult[] = exported.files;
        void standaloneExport;
        void exportedFiles;
        // @ts-expect-error Export result attributes are readonly.
        exported.outputDirectory = './elsewhere';
        // @ts-expect-error Export file arrays are readonly.
        exported.files.push({ filename: 'routes.txt', recordCount: 1 });
        void gtfs.import();
        void gtfs.realtime.refresh();
        void gtfs.import({});
        void gtfs.realtime.refresh({});
        void gtfs.import({ sources: [{ sourceId: 'test', schedule: { path: './feed' } }], validation: { mode: 'strict' }, reporting: { level: 'silent' } });
        void gtfs.export({ sourceId: 'test' });
        void gtfs.realtime.refresh({ sources: [{ sourceId: 'test', realtime: { feeds: [{ type: 'alerts', url: 'https://example.test/a.pb' }] } }], retention: { snapshotsSeconds: null } });
        // @ts-expect-error Operation sources require explicit IDs.
        void gtfs.import({ sources: [{ schedule: { path: './feed' } }] });
        // @ts-expect-error Instance connection is not a per-call option.
        void gtfs.import({ database: {} });
        const databaseAccess: GtfsDatabaseAccess = gtfs.database;
        const schema: GtfsSchema = gtfs.schema;
        const instanceReporting: GtfsReporting = gtfs.reporting;
        void databaseAccess;
        void schema;
        void instanceReporting;
        const routes: Routes[] = await gtfs.schedule.routes.all();
        const routePromise: Promise<Routes[]> = gtfs.schedule.routes.all();
        const routeStream: AsyncIterableIterator<{ route_id: string }> = gtfs.schedule.routes.select('route_id').stream();
        const required: Promise<{ route_id: string }> = gtfs.schedule.routes.select('route_id').firstOrThrow({ route_id: 'route-1' });
        void [routePromise, routeStream, required];
        // @ts-expect-error Array promises are not async iterables.
        const invalidStream: AsyncIterable<Routes> = gtfs.schedule.routes.all();
        void invalidStream;
        const routeOrder: import('gtfs').GtfsFieldOrder<'routes'>[] = [{ field: 'route_id' }];
        const routeCount: Promise<number> = gtfs.schedule.routes.orderBy(routeOrder).count();
        void routeCount;
        // @ts-expect-error Sorting requires field-order arrays.
        gtfs.schedule.routes.orderBy(() => []);
        // @ts-expect-error Predicate callbacks are not reader filters.
        gtfs.schedule.routes.where(() => ({}));
        const stopTimes: StopTimes[] = await gtfs.schedule.stopTimes.all();
        const calendar: Calendar | null = await gtfs.schedule.calendar.first();
        const boardAlight: BoardAlight[] = await gtfs.gtfsRide.boardAlight.all();
        const sqlFares = await gtfs.database.withKysely({
          callback: database => database.selectFrom('fare_attributes')
            .where('source_id', '=', 'test').where('currency_type', '=', 'USD')
            .where('price', '<=', '9007199254740993')
            .select(['fare_id', 'price']).execute(),
        });
        const storedPrice: number | string | bigint | undefined = sqlFares[0]?.price;
        void storedPrice;
        // @ts-expect-error SQL money results are not guaranteed public decimal strings.
        const publicPrice: string = sqlFares[0]!.price;
        void publicPrice;
        const matchingRoutes = await gtfs.database.withKysely({
          callback: database => database.selectFrom('routes').select('route_id')
            .where('source_id', '=', 'test')
            .where(eb => eb.exists(
              eb.selectFrom('trips').select('trip_id')
                .whereRef('trips.source_id', '=', 'routes.source_id')
                .whereRef('trips.route_id', '=', 'routes.route_id')
                .where('direction_id', '=', 0)
            ))
            .execute(),
        });
        const matchingRouteId: string | undefined = matchingRoutes[0]?.route_id;
        void matchingRouteId;
        // @ts-expect-error Existence filters do not select child columns.
        void matchingRoutes[0]?.trip_id;
        await gtfs.database.withKysely({
          callback: async database => {
            // @ts-expect-error Aliases must be declared in the query scope.
            database.selectFrom('routes').whereRef('missing.source_id', '=', 'routes.source_id');
            // @ts-expect-error SQL predicates retain stored numeric field types.
            database.selectFrom('stop_times').where('arrival_service_day_seconds', '>', '25:00:00');
          },
        });
        const summary = await gtfs.database.withKysely({
          callback: database => database.selectFrom('stop_times')
            .where('source_id', '=', 'test')
            .whereRef('departure_service_day_seconds', '>', 'arrival_service_day_seconds')
            .select(eb => [eb.fn.countAll<string | number | bigint>().as('total'),
              eb.fn.max<string | number | bigint | null>('arrival_service_day_seconds').as('latest')])
            .executeTakeFirstOrThrow(),
        });
        const total: string | number | bigint = summary.total;
        const latest: string | number | bigint | null = summary.latest;
        const numeric = await gtfs.database.withKysely({
          callback: database => database.selectFrom('stop_times').where('source_id', '=', 'test')
            .select(eb => [eb.fn.sum<string | number | null>('stop_sequence').as('sum'),
              eb.fn.avg<string | number | null>('arrival_service_day_seconds').as('average')])
            .executeTakeFirstOrThrow(),
        });
        const sum: string | number | null = numeric.sum;
        const average: string | number | null = numeric.average;
        void [sum, average];
        // @ts-expect-error SQL numeric results may be null or driver strings.
        const nonNullSum: number = numeric.sum;
        void nonNullSum;
        void [total, latest];
        // @ts-expect-error Unrequested aggregations are not returned.
        void summary.earliest;
        const groups = await gtfs.database.withKysely({
          callback: database => database.selectFrom('trips').where('source_id', '=', 'test')
            .select('route_id').select(eb => eb.fn.countAll<string | number | bigint>().as('total'))
            .groupBy('route_id').execute(),
        });
        for (const group of groups) {
          const count: string | number | bigint = group.total;
          const routeId: string = group.route_id;
          void [count, routeId];
          // @ts-expect-error Ungrouped fields are not returned.
          void group.trip_id;
        }
        void routes;
        void calendar;
        void boardAlight;
        for (const stopTime of stopTimes) {
          const sourceId: string = stopTime.source_id;
          void sourceId;
          // @ts-expect-error Default repository rows exclude unknown-field storage.
          void stopTime._unknown_fields;
          // @ts-expect-error Service-day seconds require an explicit selection.
          void stopTime.arrival_service_day_seconds;
        }
        const selected = await gtfs.schedule.stopTimes.select('arrival_service_day_seconds').all();
        for (const row of selected) {
          const seconds: number | null = row.arrival_service_day_seconds;
          void seconds;
        }
        declare const stored: GtfsStoredTableRow<'stop_times'>;
        const unknownFields: string | null = stored._unknown_fields;
        const storedSeconds: number | null = stored.arrival_service_day_seconds;
        void unknownFields;
        void storedSeconds;

        // @ts-expect-error Advanced SQLite APIs are not root exports.
        import { createSqliteGtfsTables } from 'gtfs';
        // @ts-expect-error Schema metadata is not a root export.
        import { defineGtfsTable } from 'gtfs';
        void createSqliteGtfsTables;
        void defineGtfsTable;
      `,
    ),
  ]);
});
after(async () => {
  if (workspace !== undefined) {
    await rm(workspace, { recursive: true, force: true });
  }
});
test('packed gtfs executable imports and exports a feed', async () => {
  const cliPath = path.join(projectPath, 'node_modules', '.bin', 'gtfs');
  const databasePath = path.join(workspace, 'cli.sqlite');
  const outputDirectory = path.join(workspace, 'cli-export');
  const configPath = path.join(projectPath, 'cli.json');
  await writeFile(
    configPath,
    JSON.stringify({
      database: { path: databasePath },
      sources: [
        {
          sourceId: 'cli-smoke',
          schedule: {
            path: feedPath,
            import: { validation: { mode: 'permissive' } },
          },
        },
      ],
      reporting: { level: 'silent' },
    }),
  );
  const imported = run(
    cliPath,
    ['import', '--config', configPath],
    projectPath,
  );
  assertSuccess(imported, 'installed gtfs import');
  assert.equal(imported.stdout, '');
  assert.equal(imported.stderr, '');
  assert.equal(existsSync(databasePath), true);
  const exported = run(
    cliPath,
    [
      'export',
      '--database',
      databasePath,
      '--source-id',
      'cli-smoke',
      '--output',
      outputDirectory,
      '--log-level',
      'silent',
    ],
    projectPath,
  );
  assertSuccess(exported, 'installed gtfs export');
  assert.equal(exported.stdout, '');
  assert.equal(exported.stderr, '');
  assert.match(
    await readFile(path.join(outputDirectory, 'routes.txt'), 'utf8'),
    /route-1/u,
  );
});
test('packed tarball works in an ESM project', () => {
  const cliPath = path.join(projectPath, 'node_modules', '.bin', 'gtfs');
  for (const command of commands) {
    const commandName = ['gtfs', ...command].join(' ');
    const result = run(cliPath, [...command, '--help'], projectPath);
    assertSuccess(result, `${commandName} --help`);
    assert.match(result.stdout, new RegExp(`Usage: ${commandName}`));
  }
  const smokeResult = run(
    process.execPath,
    [
      path.join(projectPath, 'smoke.mjs'),
      feedPath,
      path.join(workspace, 'smoke.sqlite'),
    ],
    projectPath,
  );
  assertSuccess(smokeResult, 'installed package smoke test');
  assert.deepEqual(JSON.parse(smokeResult.stdout), { routeCount: 1 });
  const typecheckResult = run(
    path.join(repositoryRoot, 'node_modules', '.bin', 'tsc'),
    [
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2023',
      path.join(projectPath, 'smoke.ts'),
    ],
    projectPath,
  );
  assertSuccess(typecheckResult, 'installed package TypeScript smoke test');
});

test('published documentation examples compile against the packed declarations', () => {
  const result = run(
    path.join(repositoryRoot, 'node_modules', '.bin', 'tsc'),
    [
      '--noEmit',
      '--strict',
      '--exactOptionalPropertyTypes',
      '--skipLibCheck',
      '--allowJs',
      '--checkJs',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2023',
      ...documentationTypeFiles,
    ],
    projectPath,
  );
  assertSuccess(result, 'published documentation typecheck');
});
