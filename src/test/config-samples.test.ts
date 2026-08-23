import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validateConfig } from '../lib/validate-config.ts';

const samples = [
  { filename: 'config-sample.json', requireStaticSource: true },
  { filename: 'config-sample-full.json', requireStaticSource: true },
  { filename: 'config-sample-rtupdates.json', requireStaticSource: false },
] as const;

for (const sample of samples) {
  test(`${sample.filename} is a valid runtime configuration`, async () => {
    const config = JSON.parse(
      await readFile(sample.filename, 'utf8'),
    ) as Parameters<typeof validateConfig>[0];
    const warnings: string[] = [];

    validateConfig(config, (warning) => warnings.push(warning), {
      requireStaticSource: sample.requireStaticSource,
    });

    assert.deepEqual(warnings, []);
  });
}
