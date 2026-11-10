import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

for (const adapter of ['native', 'kysely']) {
  test(
    `${adapter} writer keeps first rows across 200000 long storage keys with a 64 MiB heap`,
    { timeout: 60_000 },
    async (t) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), 'gtfs-writer-memory-'),
      );
      t.after(() => rm(directory, { recursive: true, force: true }));
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          '--max-old-space-size=64',
          '--disable-warning=ExperimentalWarning',
          'test/helpers/duplicate-writer-memory.ts',
          directory,
          adapter,
        ],
        { timeout: 55_000 },
      );
      assert.match(stdout, /Stored 200000 records/);
    },
  );
}
