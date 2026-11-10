import path from 'node:path';
import { createReadStream, createWriteStream, mkdtempSync } from 'node:fs';
import { once } from 'node:events';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { parse } from 'csv-parse';
import { openPromise } from 'yauzl';

/** Counts CSV rows; missing files and read/parse failures reject. */
export async function countCsvRows(filePath: string): Promise<number> {
  let rowCount = 0;
  await pipeline(
    createReadStream(filePath),
    parse({
      columns: true,
      relax_quotes: true,
      trim: true,
      skip_empty_lines: true,
    }),
    async (rows) => {
      for await (const _row of rows) {
        rowCount++;
      }
    },
  );

  return rowCount;
}

/** Returns counts by table name; absent optional files count as zero. */
export async function countFeedInventory(
  directory: string,
  manifest: Readonly<Record<string, Readonly<{ filename: string | null }>>>,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const filenames = new Set(await readdir(directory));

  await Promise.all(
    Object.entries(manifest).map(async ([tableName, definition]) => {
      if (definition.filename === null) {
        return;
      }
      const filePath = path.join(directory, definition.filename);
      if (!filenames.has(definition.filename)) {
        counts[tableName] = 0;
        return;
      }
      if (definition.filename.endsWith('.geojson')) {
        const document = JSON.parse(await readFile(filePath, 'utf8')) as {
          features?: unknown[];
        };
        if (!Array.isArray(document.features)) {
          throw new Error(
            `Expected a GeoJSON FeatureCollection in ${filePath}`,
          );
        }
        counts[tableName] = document.features.length;
        return;
      }
      counts[tableName] = await countCsvRows(filePath);
    }),
  );

  return counts;
}

/** Directory holding the hand-written feed that populates every column. */
export const completeFixturePath = 'test/fixtures/complete';
const caltrainFixturePath = 'test/fixtures/caltrain_20160406.zip';

export async function recreateFixtureDirectory(
  directory: string,
): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

export async function extractFixtureArchive(
  archivePath: string,
  destinationDirectory: string,
): Promise<void> {
  const archive = await openPromise(archivePath, {
    lazyEntries: true,
    autoClose: false,
    strictFileNames: true,
  });
  try {
    for await (const entry of archive.eachEntry()) {
      const outputPath = path.join(destinationDirectory, entry.fileName);
      if (entry.fileName.endsWith('/')) {
        await mkdir(outputPath, { recursive: true });
        continue;
      }
      await mkdir(path.dirname(outputPath), { recursive: true });
      await pipeline(
        await archive.openReadStreamPromise(entry),
        createWriteStream(outputPath, { flags: 'wx' }),
      );
    }
  } finally {
    const closed = once(archive, 'close');
    archive.close();
    await closed;
  }
}

/** A temporary feed directory and the cleanup that removes it. */
export interface FeedFixture {
  /** Feed directory to use as `sources[].schedule.path`. */
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Defaults to the Caltrain fixture; `none` starts empty. `extraFiles` adds or
 * overwrites files by filename. Call the returned cleanup after use.
 */
export async function createFeedFixture(options?: {
  base?: 'caltrain' | 'complete' | 'none';
  extraFiles?: Record<string, string>;
}): Promise<FeedFixture> {
  const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-fixture-'));
  await recreateFixtureDirectory(directory);

  const base = options?.base ?? 'caltrain';
  if (base === 'complete') {
    await cp(completeFixturePath, directory, { recursive: true });
  } else if (base === 'caltrain') {
    await extractFixtureArchive(caltrainFixturePath, directory);
  }

  for (const [filename, contents] of Object.entries(
    options?.extraFiles ?? {},
  )) {
    await writeFile(path.join(directory, filename), contents);
  }

  return {
    path: directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
