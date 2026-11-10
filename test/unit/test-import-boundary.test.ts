import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('behavioral tests and helpers import source while package and type contracts retain distribution access', async () => {
  for (const layer of ['unit', 'integration', 'contracts', 'helpers']) {
    const directory = path.join('test', layer);
    for (const filename of await readdir(directory, { recursive: true })) {
      if (!filename.endsWith('.ts')) {
        continue;
      }
      const source = await readFile(path.join(directory, filename), 'utf8');
      assert.doesNotMatch(
        source,
        /(?:from\s*|import\s*\()(['"])(?:gtfs(?:\/(?:schema|sqlite|kysely))?|(?:\.\.?\/)+dist\/[^'"]+)\1/u,
        `${layer}/${filename} imports a built entry point`,
      );
    }
  }
});
