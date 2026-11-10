import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

test('generated-file check fails for missing or stale output without modifying it', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-generated-check-'));
  const helperUrl = new URL(
    '../../scripts/lib/generated-file.mjs',
    import.meta.url,
  );
  const existingFile = path.join(directory, 'existing.md');
  try {
    await writeFile(existingFile, 'stale\n');
    const before = await stat(existingFile);
    for (const filename of [
      existingFile,
      path.join(directory, 'missing', 'new.md'),
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `
        import { writeGeneratedFile } from ${JSON.stringify(helperUrl.href)};
        await writeGeneratedFile(new URL(${JSON.stringify(pathToFileURL(filename).href)}), 'current\\n', { check: true });
      `,
        ],
        { encoding: 'utf8', timeout: 5000 },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /Generated file is missing or stale/);
      assert.match(result.stderr, /pnpm generated:generate/);
    }
    assert.equal(await readFile(existingFile, 'utf8'), 'stale\n');
    assert.equal((await stat(existingFile)).mtimeMs, before.mtimeMs);
    assert.deepEqual(await readdir(directory), ['existing.md']);

    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
      import { writeGeneratedFile } from ${JSON.stringify(helperUrl.href)};
      await writeGeneratedFile(new URL(${JSON.stringify(pathToFileURL(existingFile).href)}), 'stale\\n', { check: true });
    `,
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal((await stat(existingFile)).mtimeMs, before.mtimeMs);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
