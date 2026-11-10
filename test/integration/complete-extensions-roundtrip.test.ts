import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import Database from 'better-sqlite3';
import { exportGtfs } from '../../src/index.ts';
import { fixtureExtensions } from '../fixtures/extensions.ts';
import {
  extensionTables,
  extensions,
  rowsByFilename,
  expectedRows,
  writeExtensionFeed,
  assertCreatedTables,
  assertPublicRows,
  assertExportedFiles,
  importFeeds,
} from '../contracts/cases/extension-roundtrip.ts';

describe('complete optional-extension round trips', () => {
  test('fixtures cover every registered optional Schedule file and field', () => {
    assert.deepEqual(
      extensions,
      fixtureExtensions.filter((extension) => extension !== 'gtfs-realtime'),
    );
    const tables = extensions.flatMap(extensionTables);
    assert.deepEqual(
      Object.keys(rowsByFilename).sort(),
      tables.map((table) => table.filename).sort(),
    );
    for (const table of tables) {
      assert.ok(table.filename);
      for (const row of expectedRows(table.filename)) {
        assert.deepEqual(
          Object.keys(row).sort(),
          Object.keys(table.fields).sort(),
          table.filename,
        );
        for (const [field, value] of Object.entries(row)) {
          assert.ok(
            value !== null && value !== undefined && value !== '',
            `${table.filename}.${field} must be populated`,
          );
        }
      }
    }
  });

  for (const extension of extensions) {
    for (const mode of ['explicit', 'auto'] as const) {
      test(`${extension}: ${mode} selection preserves every public value through export and reimport`, async () => {
        const directory = await mkdtemp(
          path.join(tmpdir(), 'gtfs-extension-roundtrip-'),
        );
        const database = new Database(':memory:');
        const sourceId = 'extension-source';
        const selection = mode === 'auto' ? 'auto' : [extension];
        try {
          const feedPath = path.join(directory, 'feed');
          await writeExtensionFeed(feedPath, extension);
          await importFeeds(
            database,
            [{ sourceId, schedule: { path: feedPath } }],
            selection,
          );
          assertCreatedTables(database, [extension]);
          await assertPublicRows({
            database,
            extension,
            sourceId,
            enabledExtensions: [extension],
          });

          const outputDirectory = path.join(directory, 'export');
          await exportGtfs({
            database: { client: database },
            extensions: [extension],
            export: { outputDirectory, sourceId, batchSize: 1 },
            reporting: { level: 'silent' },
          });
          await assertExportedFiles(outputDirectory, extension);
          await importFeeds(
            database,
            [{ sourceId, schedule: { path: outputDirectory } }],
            selection,
          );
          assertCreatedTables(database, [extension]);
          await assertPublicRows({
            database,
            extension,
            sourceId,
            enabledExtensions: [extension],
          });
        } finally {
          database.close();
          await rm(directory, { recursive: true, force: true });
        }
      });
    }
  }

  test('auto-detects the full union across sources and round-trips each source independently', async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'gtfs-extension-union-'),
    );
    const database = new Database(':memory:');
    try {
      const sources = [];
      for (const extension of extensions) {
        const feedPath = path.join(directory, extension);
        await writeExtensionFeed(feedPath, extension);
        sources.push({ sourceId: extension, schedule: { path: feedPath } });
      }
      await importFeeds(database, sources, 'auto');
      assertCreatedTables(database, extensions);
      const exportedSources = [];
      for (const extension of extensions) {
        await assertPublicRows({
          database,
          extension,
          sourceId: extension,
          enabledExtensions: extensions,
        });
        const outputDirectory = path.join(directory, 'exports', extension);
        await mkdir(path.dirname(outputDirectory), { recursive: true });
        await exportGtfs({
          database: { client: database },
          extensions,
          export: { outputDirectory, sourceId: extension, batchSize: 1 },
          reporting: { level: 'silent' },
        });
        await assertExportedFiles(outputDirectory, extension);
        exportedSources.push({
          sourceId: extension,
          schedule: { path: outputDirectory },
        });
      }
      await importFeeds(database, exportedSources, 'auto');
      assertCreatedTables(database, extensions);
      for (const extension of extensions) {
        await assertPublicRows({
          database,
          extension,
          sourceId: extension,
          enabledExtensions: extensions,
        });
      }
    } finally {
      database.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
