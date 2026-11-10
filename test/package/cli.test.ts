import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

import packageJson from '../../package.json' with { type: 'json' };

import { stripColors } from '../helpers/console-output.ts';

const commands = [
  'gtfs import',
  'gtfs export',
  'gtfs realtime refresh',
] as const;

function runCli(
  command: (typeof commands)[number] | 'gtfs' | 'gtfs realtime',
  args: string[],
  cwd: string,
) {
  const result = spawnSync(
    process.execPath,
    [path.resolve('dist/bin/gtfs.js'), ...command.split(' ').slice(1), ...args],
    {
      cwd,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  return {
    ...result,
    // Compare diagnostic text independently of color support, retaining cursor controls.
    stderr: stripColors(result.stderr ?? ''),
  };
}

function assertSuccess(result: ReturnType<typeof runCli>): void {
  assert.equal(
    result.status,
    0,
    `Command failed:\n${result.stdout}${result.stderr}`,
  );
}

async function createProject(): Promise<{
  directory: string;
  feedPath: string;
}> {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-test-'));
  const feedPath = path.join(directory, 'feed');
  await mkdir(feedPath);
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
      path.join(feedPath, 'trips.txt'),
      ['route_id,service_id,trip_id', 'route-1,service-1,trip-1'].join('\n'),
    ),
    writeFile(
      path.join(feedPath, 'stop_times.txt'),
      [
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence',
        'trip-1,09:00:00,09:00:00,stop-1,1',
      ].join('\n'),
    ),
    writeFile(
      path.join(feedPath, 'stops.txt'),
      [
        'stop_id,stop_name,stop_lat,stop_lon',
        'stop-1,Test Stop,37.78,-122.42',
      ].join('\n'),
    ),
    writeFile(
      path.join(feedPath, 'calendar_dates.txt'),
      ['service_id,date,exception_type', 'service-1,20260825,1'].join('\n'),
    ),
  ]);
  return { directory, feedPath };
}

function assertImportedDatabase(databasePath: string, sourceId: string): void {
  assert.equal(existsSync(databasePath), true);
  const db = new Database(databasePath, { readonly: true });
  try {
    assert.equal(
      db.prepare('SELECT route_short_name FROM routes').pluck().get(),
      '1',
    );
    assert.deepEqual(
      db.prepare('SELECT DISTINCT source_id FROM routes').pluck().all(),
      [sourceId],
    );
  } finally {
    db.close();
  }
}

test('import rejects an omitted database destination before reading the feed', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-destination-'));
  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify({
        database: {},
        sources: [{ schedule: { path: 'not-read-without-a-destination' } }],
      }),
    );
    const result = runCli('gtfs import', [], directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid configuration/);
    assert.match(result.stderr, /explicit `database.path`/);
    assert.doesNotMatch(result.stderr, /does not exist/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('command help works without loading configuration', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-test-'));

  try {
    await writeFile(path.join(directory, 'config.json'), 'not valid JSON');
    for (const command of commands) {
      await t.test(`${command} --help`, () => {
        const result = runCli(command, ['--help'], directory);
        assertSuccess(result);
        assert.match(result.stdout, new RegExp(`Usage: ${command}`));
        assert.doesNotMatch(
          result.stdout,
          /option of the same\s+name in config\.json/u,
        );
        if (command === 'gtfs import') {
          assert.match(
            result.stdout,
            /--source-id <id>\s+Identity for --input or --url only \[default: default\]/u,
          );
        } else if (command === 'gtfs export') {
          assert.match(
            result.stdout,
            /--source-id <id>\s+Source ID to export/u,
          );
        } else {
          assert.doesNotMatch(result.stdout, /--source-id/u);
        }
        assert.equal(result.stderr, '');
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('root and Realtime group help list commands without loading configuration', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-help-'));
  try {
    await writeFile(path.join(directory, 'config.json'), 'not valid JSON');
    for (const command of ['gtfs', 'gtfs realtime'] as const) {
      for (const args of [[], ['--help']]) {
        await t.test(`${command} ${args.join(' ')}`, () => {
          const result = runCli(command, args, directory);
          assertSuccess(result);
          assert.match(
            result.stdout,
            new RegExp(`Usage: ${command} <command> \\[options\\]`),
          );
          assert.match(result.stdout, /Commands:/u);
          assert.match(result.stdout, /--help/u);
          assert.match(result.stdout, /--version/u);
          if (command === 'gtfs') {
            assert.match(result.stdout, /^ {2}import\s+/mu);
            assert.match(result.stdout, /^ {2}export\s+/mu);
            assert.match(result.stdout, /^ {2}realtime refresh\s+/mu);
          } else {
            assert.match(result.stdout, /^ {2}refresh\s+/mu);
            assert.doesNotMatch(result.stdout, /^ {2}(?:import|export)\s+/mu);
          }
          assert.equal(result.stderr, '');
        });
      }
    }
    const version = runCli('gtfs', ['--version'], directory);
    assertSuccess(version);
    assert.equal(version.stdout.trim(), packageJson.version);
    assert.equal(version.stderr, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('unknown commands and misplaced flags fail before loading configuration', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-routing-'));
  try {
    await writeFile(path.join(directory, 'config.json'), 'not valid JSON');
    for (const { command, args, message } of [
      {
        command: 'gtfs',
        args: ['unknown'],
        message: /Unknown command "unknown"/u,
      },
      {
        command: 'gtfs realtime',
        args: ['unknown'],
        message: /Unknown command "unknown"/u,
      },
      {
        command: 'gtfs',
        args: ['--database', 'unused.sqlite', 'import'],
        message: /Unknown option.*database/u,
      },
      {
        command: 'gtfs realtime',
        args: ['--config', 'config.json'],
        message: /Unknown option.*config/u,
      },
      {
        command: 'gtfs import',
        args: ['extra'],
        message: /Unexpected argument/u,
      },
      {
        command: 'gtfs export',
        args: ['--input', 'feed.zip'],
        message: /Unknown option.*input/u,
      },
      {
        command: 'gtfs realtime refresh',
        args: ['--output', 'unused'],
        message: /Unknown option.*output/u,
      },
    ] as const) {
      await t.test(`${command} ${args.join(' ')}`, () => {
        const result = runCli(command, [...args], directory);
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, message);
        assert.match(result.stderr, new RegExp(`${command} --help`));
        assert.doesNotMatch(result.stderr, /Invalid JSON/u);
        assert.equal(existsSync(path.join(directory, 'unused.sqlite')), false);
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gtfs import uses ./config.json when no CLI source is supplied', async () => {
  const { directory, feedPath } = await createProject();
  const databasePath = path.join(directory, 'default.sqlite');

  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify({
        database: { path: databasePath },
        sources: [
          {
            sourceId: 'test',
            schedule: {
              path: feedPath,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        reporting: { level: 'silent' },
      }),
    );

    const result = runCli('gtfs import', [], directory);
    assertSuccess(result);
    assertImportedDatabase(databasePath, 'test');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gtfs import rejects identity-only overrides before changing a configured database', async () => {
  const { directory, feedPath } = await createProject();
  const databasePath = path.join(directory, 'existing.sqlite');

  try {
    assertSuccess(
      runCli(
        'gtfs import',
        [
          '--input',
          feedPath,
          '--source-id',
          'existing',
          '--database',
          databasePath,
          '--log-level',
          'silent',
        ],
        directory,
      ),
    );
    const originalDatabase = await readFile(databasePath);

    for (const sourceIds of [['configured'], ['configured', 'second']]) {
      for (const filename of ['config.json', 'explicit.json']) {
        const configPath = path.join(directory, filename);
        const config = JSON.stringify({
          database: { path: databasePath },
          sources: sourceIds.map((sourceId) => ({
            sourceId,
            schedule: { path: feedPath },
          })),
          reporting: { level: 'info' },
        });
        await writeFile(configPath, config);
        const result = runCli(
          'gtfs import',
          [
            ...(filename === 'config.json' ? [] : ['--config', configPath]),
            '--source-id',
            'configured',
          ],
          directory,
        );
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /Error: \[GTFS\]/u);
        assert.match(
          result.stderr,
          /--source-id.*requires `--input` or `--url`/u,
        );
        assert.match(result.stderr, /sources\[\]\.sourceId/u);
        assert.doesNotMatch(result.stderr, /Starting GTFS import/u);
        assert.deepEqual(await readFile(databasePath), originalDatabase);
        assert.equal(await readFile(configPath, 'utf8'), config);
      }
    }

    const unusedDatabasePath = path.join(directory, 'unused.sqlite');
    const result = runCli(
      'gtfs import',
      ['--source-id', 'new-identity', '--database', unusedDatabasePath],
      directory,
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--source-id.*requires `--input` or `--url`/u);
    assert.equal(existsSync(unusedDatabasePath), false);
    assert.deepEqual(await readFile(databasePath), originalDatabase);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('direct CLI source options take precedence over ./config.json', async () => {
  const { directory, feedPath } = await createProject();
  const defaultDatabasePath = path.join(directory, 'default.sqlite');
  const cliDatabasePath = path.join(directory, 'cli.sqlite');

  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify({
        database: { path: defaultDatabasePath },
        sources: [
          {
            sourceId: 'test',
            schedule: { path: path.join(directory, 'missing-feed') },
          },
        ],
      }),
    );

    const result = runCli(
      'gtfs import',
      [
        '--input',
        feedPath,
        '--source-id',
        'direct-cli',
        '--database',
        cliDatabasePath,
        '--log-level',
        'silent',
      ],
      directory,
    );
    assertSuccess(result);
    assertImportedDatabase(cliDatabasePath, 'direct-cli');
    assert.equal(existsSync(defaultDatabasePath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI diagnostics use stderr and leave stdout empty', async () => {
  const { directory, feedPath } = await createProject();
  const databasePath = path.join(directory, 'diagnostics.sqlite');

  try {
    const result = runCli(
      'gtfs import',
      [
        '--input',
        feedPath,
        '--source-id',
        'diagnostics',
        '--database',
        databasePath,
        '--log-level',
        'info',
      ],
      directory,
    );
    assertSuccess(result);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /Starting GTFS import/u);
    assert.equal(
      result.stderr.split('\n').slice(0, 3).join('\n'),
      `==> Importing static GTFS from ${feedPath}\n` +
        `Using sqlite3 database at ${databasePath}\n` +
        'Info: Validation off; set the `sources[].schedule.import.validation.mode` configuration option to "strict" to enable it',
    );
    assert.doesNotMatch(
      result.stderr,
      /Validating GTFS files|Validated GTFS files/u,
    );
    assert.match(result.stderr, /✔\s+Completed GTFS import/u);
    const lines = result.stderr.trimEnd().split('\n');
    assert.equal(lines.at(-1), `sqlite3 database at ${databasePath}`);
    const summary = lines.at(-2);
    assert.ok(summary);
    assert.match(summary, /^✔\s+Completed GTFS import.*\d+\.\d seconds$/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gtfs export applies final direct output and source options', async () => {
  const { directory, feedPath } = await createProject();
  const databasePath = path.join(directory, 'export.sqlite');
  const outputDirectory = path.join(directory, 'exported');

  try {
    assertSuccess(
      runCli(
        'gtfs import',
        [
          '--input',
          feedPath,
          '--source-id',
          'export-source',
          '--database',
          databasePath,
          '--log-level',
          'silent',
        ],
        directory,
      ),
    );
    const result = runCli(
      'gtfs export',
      [
        '--database',
        databasePath,
        '--source-id',
        'export-source',
        '--output',
        outputDirectory,
        '--log-level',
        'info',
      ],
      directory,
    );
    assertSuccess(result);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /==> Starting GTFS export/u);
    assert.match(result.stderr, /==> Exporting GTFS files/u);
    assert.match(result.stderr, /✔\s+routes\.txt/u);
    assert.match(result.stderr, /✔\s+Completed GTFS export/u);
    assert.equal(existsSync(path.join(outputDirectory, 'routes.txt')), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gtfs realtime refresh loads the final generic feed configuration', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-test-'));
  const databasePath = path.join(directory, 'realtime.sqlite');
  const realtime = GtfsRealtimeBindings.transit_realtime;
  const payload = Buffer.from(
    realtime.FeedMessage.encode(
      realtime.FeedMessage.fromObject({
        header: { gtfsRealtimeVersion: '2.0' },
        entity: [
          {
            id: 'cli-alert',
            alert: {
              headerText: { translation: [{ text: 'CLI alert' }] },
              descriptionText: {
                translation: [{ text: 'CLI alert description' }],
              },
            },
          },
        ],
      }),
    ).finish(),
  );
  const configPath = path.join(directory, 'realtime.json');

  try {
    await writeFile(
      configPath,
      JSON.stringify({
        database: { path: databasePath },
        extensions: ['gtfs-realtime'],
        sources: [
          {
            sourceId: 'cli',
            realtime: {
              feeds: [
                {
                  feedId: 'primary',
                  url: `data:application/x-protobuf;base64,${payload.toString('base64')}`,
                },
              ],
            },
          },
        ],
        reporting: { level: 'silent' },
      }),
    );
    const result = runCli(
      'gtfs realtime refresh',
      ['--config', configPath, '--log-level', 'info'],
      directory,
    );
    assertSuccess(result);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /==> Starting GTFS-Realtime refresh/u);
    assert.match(result.stderr, /==> Importing GTFS-Realtime feed/u);
    assert.match(result.stderr, /✔\s+Realtime feed primary/u);
    assert.match(result.stderr, /✔\s+Completed GTFS-Realtime refresh/u);
    const database = new Database(databasePath, { readonly: true });
    try {
      assert.equal(
        database.prepare('SELECT header_text FROM alerts').pluck().get(),
        'CLI alert',
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('--config takes precedence over ./config.json and CLI values override that file', async () => {
  const { directory, feedPath } = await createProject();
  const defaultDatabasePath = path.join(directory, 'default.sqlite');
  const configuredDatabasePath = path.join(directory, 'configured.sqlite');
  const cliDatabasePath = path.join(directory, 'cli.sqlite');
  const explicitConfigPath = path.join(directory, 'explicit.json');

  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify({
        database: { path: defaultDatabasePath },
        sources: [
          {
            sourceId: 'test',
            schedule: { path: path.join(directory, 'missing-feed') },
          },
        ],
      }),
    );
    await writeFile(
      explicitConfigPath,
      JSON.stringify({
        database: { path: configuredDatabasePath },
        sources: [
          {
            sourceId: 'test',
            schedule: {
              path: feedPath,
              import: {
                validation: {
                  mode: 'permissive',
                  onUnknownField: 'discard',
                },
              },
            },
          },
        ],
        reporting: { level: 'info' },
      }),
    );

    const result = runCli(
      'gtfs import',
      [
        '--config',
        explicitConfigPath,
        '--database',
        cliDatabasePath,
        '--log-level',
        'silent',
      ],
      directory,
    );
    assertSuccess(result);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assertImportedDatabase(cliDatabasePath, 'test');
    assert.equal(existsSync(defaultDatabasePath), false);
    assert.equal(existsSync(configuredDatabasePath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI commands reject invalid log levels and unknown arguments', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-test-'));

  try {
    const invalidLevel = runCli(
      'gtfs import',
      ['--log-level', 'debug'],
      directory,
    );
    assert.equal(invalidLevel.status, 1);
    assert.match(
      invalidLevel.stderr,
      /Invalid value "debug" for `--log-level`/,
    );

    const mutuallyExclusive = runCli(
      'gtfs import',
      ['--input', 'feed.zip', '--url', 'https://example.test/feed.zip'],
      directory,
    );
    assert.equal(mutuallyExclusive.status, 1);
    assert.match(mutuallyExclusive.stderr, /either `--input` or `--url`/);

    const malformedConfig = path.join(directory, 'malformed.json');
    await writeFile(malformedConfig, '{ "database": ');

    for (const command of commands) {
      await t.test(command, () => {
        const result = runCli(command, ['--unknownOption'], directory);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Unknown option.*unknownOption/);
        assert.match(result.stderr, new RegExp(`${command} --help`));
      });

      await t.test(`${command} malformed config`, () => {
        const result = runCli(
          command,
          ['--config', malformedConfig],
          directory,
        );
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Invalid JSON in configuration file/);
        assert.equal(result.stdout, '');
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
