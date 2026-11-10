import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('benchmark statistics and equivalence checks retain independent expectations', () => {
  const result = spawnSync(
    process.execPath,
    ['--test', 'scripts/benchmark/metrics.test.mjs'],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
