import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import packageJson from '../../package.json' with { type: 'json' };

const commands = ['gtfs-import', 'gtfs-export', 'gtfsrealtime-update'] as const;

function runCli(
  command: (typeof commands)[number],
  args: string[],
  cwd: string,
) {
  return spawnSync(
    process.execPath,
    [path.resolve(`dist/bin/${command}.js`), ...args],
    {
      cwd,
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
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
  ]);
  return { directory, feedPath };
}

function assertImportedDatabase(databasePath: string): void {
  assert.equal(existsSync(databasePath), true);
  const db = new Database(databasePath, { readonly: true });
  try {
    assert.equal(
      db.prepare('SELECT route_short_name FROM routes').pluck().get(),
      '1',
    );
  } finally {
    db.close();
  }
}

test('CLI commands support --help and --version', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-cli-test-'));

  try {
    for (const command of commands) {
      await t.test(`${command} --help`, () => {
        const result = runCli(command, ['--help'], directory);
        assertSuccess(result);
        assert.match(result.stdout, new RegExp(`Usage: ${command}`));
        assert.equal(result.stderr, '');
      });

      await t.test(`${command} --version`, () => {
        const result = runCli(command, ['--version'], directory);
        assertSuccess(result);
        assert.equal(result.stdout.trim(), packageJson.version);
        assert.equal(result.stderr, '');
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('gtfs-import uses ./config.json when no CLI source is supplied', async () => {
  const { directory, feedPath } = await createProject();
  const databasePath = path.join(directory, 'default.sqlite');

  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify({
        agencies: [{ path: feedPath }],
        sqlitePath: databasePath,
        logLevel: 'silent',
      }),
    );

    const result = runCli('gtfs-import', [], directory);
    assertSuccess(result);
    assertImportedDatabase(databasePath);
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
        agencies: [{ path: path.join(directory, 'missing-feed') }],
        sqlitePath: defaultDatabasePath,
      }),
    );

    const result = runCli(
      'gtfs-import',
      [
        '--gtfsPath',
        feedPath,
        '--sqlitePath',
        cliDatabasePath,
        '--logLevel',
        'silent',
      ],
      directory,
    );
    assertSuccess(result);
    assertImportedDatabase(cliDatabasePath);
    assert.equal(existsSync(defaultDatabasePath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('--configPath takes precedence over ./config.json and CLI values override that file', async () => {
  const { directory, feedPath } = await createProject();
  const defaultDatabasePath = path.join(directory, 'default.sqlite');
  const configuredDatabasePath = path.join(directory, 'configured.sqlite');
  const cliDatabasePath = path.join(directory, 'cli.sqlite');
  const explicitConfigPath = path.join(directory, 'explicit.json');

  try {
    await writeFile(
      path.join(directory, 'config.json'),
      JSON.stringify({
        agencies: [{ path: path.join(directory, 'missing-feed') }],
        sqlitePath: defaultDatabasePath,
      }),
    );
    await writeFile(
      explicitConfigPath,
      JSON.stringify({
        agencies: [{ path: feedPath }],
        sqlitePath: configuredDatabasePath,
        logLevel: 'info',
      }),
    );

    const result = runCli(
      'gtfs-import',
      [
        '--configPath',
        explicitConfigPath,
        '--sqlitePath',
        cliDatabasePath,
        '--logLevel',
        'silent',
      ],
      directory,
    );
    assertSuccess(result);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    assertImportedDatabase(cliDatabasePath);
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
      'gtfs-import',
      ['--logLevel', 'debug'],
      directory,
    );
    assert.equal(invalidLevel.status, 1);
    assert.match(invalidLevel.stderr, /Invalid --logLevel=debug/);

    for (const command of commands) {
      await t.test(command, () => {
        const result = runCli(command, ['--unknownOption'], directory);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Unknown option.*unknownOption/);
        assert.match(result.stderr, new RegExp(`${command} --help`));
      });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
