import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('coverage inventory exposes unreported sources and rejects generated or built files', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gtfs-coverage-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const excluded = [
    'src/generated/repositories.ts',
    'src/data/case-fold.ts',
    'src/types/config.ts',
    'src/schema/tables/stops.ts',
    'src/schema/row-types.ts',
    'src/schema/managed-tables.ts',
    'src/schema/database.ts',
  ];
  for (const filename of ['src/index.ts', 'src/unloaded.ts', ...excluded]) {
    const destination = path.join(root, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, '');
  }
  const inventory = (lcov: string) =>
    spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { createCoverageInventory } from './scripts/lib/coverage-scope.mjs';
     console.log(JSON.stringify(createCoverageInventory(process.argv[1], process.argv[2])));`,
        lcov,
        root,
      ],
      { encoding: 'utf8' },
    );
  const result = inventory(
    `SF:src/index.ts\nend_of_record\nSF:${path.join(root, 'src/index.ts')}\nend_of_record\n`,
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.reportedFiles, ['src/index.ts']);
  assert.deepEqual(report.unreportedFiles, ['src/unloaded.ts']);
  assert.deepEqual(report.excludedFiles, excluded.sort());
  for (const filename of [
    ...excluded,
    'dist/index.js',
    'test/unit/example.test.ts',
  ]) {
    const invalid = inventory(`SF:${filename}\nend_of_record\n`);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Unexpected file in source coverage/);
  }
  assert.notEqual(inventory('').status, 0);
});
