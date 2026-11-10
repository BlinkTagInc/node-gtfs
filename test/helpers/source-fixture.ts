import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';

export async function createSourceFixtureFile(
  t: TestContext,
  {
    filename,
    contents,
  }: {
    readonly filename: string;
    readonly contents: string | Buffer;
  },
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-source-fixture-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, filename);
  await writeFile(filePath, contents);
  return { directory, filePath };
}
