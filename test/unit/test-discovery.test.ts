import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('test discovery includes nested runtime tests and excludes helpers, types, fixtures, and release smoke', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-test-discovery-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filenames = [
    'unit/parser.test.ts',
    'contracts/nested/query.test.ts',
    'integration/import.test.ts',
    'package/exports.test.ts',
    'package/release-smoke.ts',
    'helpers/fixture.ts',
    'types/queries.ts',
    'fixtures/feed.txt',
  ];
  for (const filename of filenames) {
    const destination = path.join(directory, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, '');
  }
  // Exercise the same ESM discovery module used by normal and coverage commands.
  const discover = (layer: string) =>
    spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { discoverTests } from './scripts/lib/test-files.mjs';
     console.log(JSON.stringify(discoverTests(process.argv[1], process.argv[2])));`,
        layer,
        directory,
      ],
      { encoding: 'utf8' },
    );
  const all = discover('all');
  assert.equal(all.status, 0, all.stderr);
  assert.deepEqual(
    JSON.parse(all.stdout),
    filenames
      .filter((name) => name.endsWith('.test.ts'))
      .sort()
      .map((name) => path.join(directory, name)),
  );
  const contracts = discover('contracts');
  assert.equal(contracts.status, 0, contracts.stderr);
  assert.deepEqual(JSON.parse(contracts.stdout), [
    path.join(directory, 'contracts/nested/query.test.ts'),
  ]);
  assert.notEqual(discover('typo').status, 0);
  await writeFile(path.join(directory, 'helpers/misplaced.test.ts'), '');
  const misplaced = discover('all');
  assert.notEqual(misplaced.status, 0);
  assert.match(misplaced.stderr, /outside a test layer/);
});

test('complete backend command rejects missing URLs instead of silently skipping servers', () => {
  for (const missing of ['GTFS_TEST_POSTGRES_URL', 'GTFS_TEST_MYSQL_URL']) {
    const env = {
      ...process.env,
      GTFS_TEST_POSTGRES_URL: 'postgresql://unused',
      GTFS_TEST_MYSQL_URL: 'mysql://unused',
      [missing]: '',
    };
    const result = spawnSync(
      process.execPath,
      ['scripts/run-tests.mjs', 'contracts', '--require-databases'],
      { env, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`${missing} is required`));
  }
});
