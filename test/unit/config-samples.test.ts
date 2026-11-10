import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { resolveGtfsConfig } from '../../src/config/resolver.ts';

const samples = [
  { filename: 'config-sample.json', operation: 'import' },
  { filename: 'config-sample-full.json', operation: 'import' },
  { filename: 'config-sample-realtime.json', operation: 'realtime' },
] as const;

for (const sample of samples) {
  test(`${sample.filename} is a valid final v5 JSON configuration`, async () => {
    const config: unknown = JSON.parse(await readFile(sample.filename, 'utf8'));
    const resolved = resolveGtfsConfig(config, {
      format: 'json',
      operation: sample.operation,
    });

    assert.ok(Object.isFrozen(resolved));
    assert.ok(resolved.sources.length > 0);
    if (sample.filename !== 'config-sample-full.json') {
      assert.equal(resolved.sources[0]!.sourceId, 'default');
    }
  });
}
