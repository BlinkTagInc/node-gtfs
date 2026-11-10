import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { it } from 'node:test';

import { resolveGtfsImportConfig } from '../../src/config/resolver.ts';
import {
  prepareScheduleSource,
  detectScheduleSourceExtensions,
} from '../../src/schedule/import/prepare-source.ts';
import { encodeZipFixture } from '../helpers/zip-fixture.ts';

it('prepares sources without copying resolved config and owns only the staged files', async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'gtfs-preparation-test-'),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(
    path.join(directory, 'agency.txt'),
    'agency_id,agency_name\nagency,Agency\n',
  );
  await writeFile(
    path.join(directory, 'directions.txt'),
    'route_id,direction_id,direction\nroute,0,Outbound\n',
  );
  const config = resolveGtfsImportConfig({
    database: { path: ':memory:' },
    extensions: 'auto',
    sources: [{ schedule: { path: directory } }],
  });
  const source = config.sources[0];
  assert.ok(source);
  const prepared = await prepareScheduleSource({
    source,
    reporting: config.reporting,
  });
  t.after(() => prepared.cleanup());
  assert.equal(prepared.source, source);
  assert.equal(prepared.source.schedule.import, source.schedule.import);
  assert.equal(Object.isFrozen(prepared), true);
  assert.notEqual(prepared.stagingDirectory, directory);
  assert.equal(
    await readFile(path.join(prepared.stagingDirectory, 'agency.txt'), 'utf8'),
    await readFile(path.join(directory, 'agency.txt'), 'utf8'),
  );
  const extensions = detectScheduleSourceExtensions([prepared]);
  assert.deepEqual(extensions, ['gtfs-plus']);
  assert.equal(Object.isFrozen(extensions), true);
  const excluded = resolveGtfsImportConfig({
    database: { path: ':memory:' },
    sources: [
      { schedule: { path: directory, excludeFiles: ['directions.txt'] } },
    ],
  }).sources[0];
  assert.ok(excluded);
  assert.deepEqual(
    detectScheduleSourceExtensions([{ ...prepared, source: excluded }]),
    [],
  );
  await prepared.cleanup();
  await prepared.cleanup();
  assert.equal(existsSync(prepared.stagingDirectory), false);
  assert.equal(existsSync(path.join(directory, 'agency.txt')), true);
});

it(
  'failed downloads and ZIP extraction remove all staging files and preserve an existing source',
  { timeout: 15_000 },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-limit-cleanup-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const staging = path.join(directory, 'staging');
    await mkdir(staging);
    const cases = [
      {
        filename: 'declared.zip',
        entries: [{ name: 'agency.txt', content: '123456' }],
        archive: { maxExtractedFileBytes: 2 },
        code: 'GTFS_ZIP_LIMIT_EXCEEDED',
      },
      {
        filename: 'forged.zip',
        entries: [
          {
            name: 'agency.txt',
            content: Buffer.alloc(65536, 65),
            declaredSize: 1,
            deflate: true,
          },
        ],
        archive: { maxExtractedTotalBytes: 1024 },
        code: 'GTFS_ZIP_LIMIT_EXCEEDED',
      },
      {
        filename: 'write-failure.zip',
        entries: [
          { name: 'link', content: 'file' },
          { name: 'link/agency.txt', content: 'cannot write through a file' },
        ],
        archive: {},
        code: 'GTFS_ZIP_INVALID',
      },
    ];
    for (const item of cases) {
      await writeFile(
        path.join(directory, item.filename),
        encodeZipFixture(item.entries),
      );
    }
    // Isolate TMPDIR in a child so parallel tests cannot observe this override.
    await promisify(execFile)(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `
    import assert from 'node:assert/strict';
    import { readdir } from 'node:fs/promises';
    import path from 'node:path';
    const { importGtfs } = await import(process.argv[1]);
    const { default: Database } = await import('better-sqlite3');
    const client = new Database(':memory:');
    const common = { database: { client }, reporting: { level: 'silent' } };
    try {
      await importGtfs({ ...common, sources: [{ schedule: { path: process.argv[2] } }] });
      const before = client.prepare('SELECT * FROM agency').all();
      for (const item of JSON.parse(process.argv[4])) {
          const config = {
            ...common,
            sources: [{ schedule: { path: path.join(process.argv[3], item.filename), import: { archive: item.archive } } }],
          };
        await assert.rejects(importGtfs(config), { code: item.code });
        assert.deepEqual(client.prepare('SELECT * FROM agency').all(), before);
        assert.deepEqual(await readdir(process.env.TMPDIR), []);
      }
      globalThis.fetch = async () => new Response(new Uint8Array(10));
      await assert.rejects(importGtfs({
          ...common,
          sources: [{ schedule: { url: 'https://example.com/feed.zip', import: { archive: { maxCompressedBytes: 2 } } } }],
        }), { code: 'GTFS_DOWNLOAD_TOO_LARGE' });
      assert.deepEqual(client.prepare('SELECT * FROM agency').all(), before);
      assert.deepEqual(await readdir(process.env.TMPDIR), []);
    } finally {
      client.close();
    }
  `,
        new URL('../../src/index.ts', import.meta.url).href,
        path.resolve('test/fixtures/complete'),
        directory,
        JSON.stringify(
          cases.map(({ filename, archive, code }) => ({
            filename,
            archive,
            code,
          })),
        ),
      ],
      {
        env: { ...process.env, TMPDIR: staging },
        timeout: 12_000,
      },
    );
  },
);
