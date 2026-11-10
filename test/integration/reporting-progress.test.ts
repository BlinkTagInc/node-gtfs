import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';

import {
  GtfsErrorCode,
  importGtfs,
  type GtfsReportEvent,
} from '../../src/index.ts';
import { resolveGtfsImportConfig } from '../../src/config/resolver.ts';
import { prepareScheduleSource } from '../../src/schedule/import/prepare-source.ts';
import { encodeZipFixture } from '../helpers/zip-fixture.ts';

for (const sourceId of ['default', 'metro']) {
  for (const useDirectImport of [false, true]) {
    test(`announces replacement for ${sourceId} before ${useDirectImport ? 'direct import' : 'preparation'} without deleting early`, async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-replacement-'));
      const client = new Database(':memory:');
      t.after(async () => {
        client.close();
        await rm(directory, { recursive: true, force: true });
      });
      const filename = path.join(directory, 'stops.txt');
      await writeFile(filename, 'stop_id,stop_name\n1,Original\n');
      const events: GtfsReportEvent[] = [];
      let checkOriginalData = false;
      const run = (
        onExistingData: 'replace-source' | 'reject' = 'replace-source',
      ) =>
        importGtfs({
          database: { client },
          sources: [
            {
              sourceId,
              schedule: {
                path: directory,
                import: {
                  onExistingData,
                  validation: {
                    onUnknownField: useDirectImport ? 'preserve' : 'discard',
                  },
                },
              },
            },
          ],
          reporting: {
            reporter(event) {
              events.push(event);
              if (
                checkOriginalData &&
                event.message.includes('will be replaced')
              ) {
                assert.equal(
                  client.prepare('SELECT stop_name FROM stops').pluck().get(),
                  'Original',
                );
              }
            },
          },
        });
      await run();
      assert.equal(
        events.filter((event) => event.message === 'Creating database indexes')
          .length,
        1,
      );
      assert.ok(
        !events.some((event) => event.message.includes('will be replaced')),
      );
      assert.ok(
        !events.some((event) => event.message.startsWith('Deleting existing')),
      );
      events.length = 0;
      checkOriginalData = true;
      await writeFile(filename, 'stop_id,stop_name\n1,Replacement\n');
      await run();
      assert.ok(
        !events.some((event) => event.message === 'Creating database indexes'),
      );
      const notices = events.filter((event) =>
        event.message.includes('will be replaced'),
      );
      assert.equal(notices.length, 1);
      const notice = notices[0];
      assert.ok(notice?.type === 'status');
      assert.equal(
        notice.message,
        sourceId === 'default'
          ? 'Existing schedule data will be replaced'
          : 'Existing schedule data for source "metro" will be replaced',
      );
      assert.equal(notice.phase, undefined);
      assert.equal(notice.heading, false);
      assert.ok(
        events.indexOf(notice) <
          events.findIndex(
            (event) =>
              event.message ===
              (useDirectImport
                ? 'Importing GTFS files'
                : 'Preparing GTFS files'),
          ),
      );
      assert.ok(
        !events.some((event) => event.message.startsWith('Replacing existing')),
      );
      const deletion = events.filter((event) =>
        /^Delet(?:ing|ed) existing schedule data/u.test(event.message),
      );
      const sourceDescription =
        sourceId === 'default' ? '' : ' for source "metro"';
      assert.deepEqual(
        deletion.map((event) => event.message),
        [
          `Deleting existing schedule data${sourceDescription}`,
          `Deleted existing schedule data${sourceDescription}`,
        ],
      );
      assert.ok(
        deletion.every(
          (event) => event.type === 'status' && event.progressBar === false,
        ),
      );
      const deletionStart = events.indexOf(deletion[0]!);
      assert.ok(deletion[0]?.type === 'status' && deletion[0].heading === true);
      const deletionEnd = events.indexOf(deletion[1]!);
      const filePreparationEnd = events.findLastIndex(
        (event) =>
          event.type === 'status' &&
          event.phase === 'complete' &&
          event.progressBar === false &&
          event.filename !== undefined,
      );
      assert.ok(
        useDirectImport
          ? deletionEnd < filePreparationEnd
          : deletionStart > filePreparationEnd,
      );
      assert.ok(
        deletionEnd <
          events.findIndex((event) => event.message === 'Importing GTFS files'),
      );
      assert.equal(
        client.prepare('SELECT stop_name FROM stops').pluck().get(),
        'Replacement',
      );
      events.length = 0;
      checkOriginalData = false;
      client.exec(
        "CREATE TRIGGER fail_delete BEFORE DELETE ON stops BEGIN SELECT RAISE(ABORT, 'injected deletion failure'); END",
      );
      await assert.rejects(run());
      assert.ok(
        events.some((event) => event.message.startsWith('Deleting existing')),
      );
      assert.ok(
        !events.some((event) => event.message.startsWith('Deleted existing')),
      );
      assert.equal(
        client.prepare('SELECT stop_name FROM stops').pluck().get(),
        'Replacement',
      );
      client.exec('DROP TRIGGER fail_delete');
      events.length = 0;
      await writeFile(filename, 'stop_id,stop_name\n"malformed');
      await assert.rejects(run('reject'), {
        code: GtfsErrorCode.DATABASE_SOURCE_EXISTS,
      });
      assert.ok(
        !events.some(
          (event) =>
            event.message ===
            (useDirectImport ? 'Importing GTFS files' : 'Preparing GTFS files'),
        ),
      );
      assert.equal(
        client.prepare('SELECT stop_name FROM stops').pluck().get(),
        'Replacement',
      );
    });
  }
}

for (const useDirectImport of [false, true]) {
  test(`${useDirectImport ? 'direct import' : 'preparation'} reports files and intermediate row counts without guessed totals`, async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'gtfs-preparation-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await copyFile(
      'test/fixtures/complete/agency.txt',
      path.join(directory, 'agency.txt'),
    );
    await writeFile(
      path.join(directory, 'stops.txt'),
      'stop_id,stop_name,stop_lat,stop_lon\n' +
        Array.from(
          { length: 1200 },
          (_, index) => `${index},Stop ${index},1,1\n`,
        ).join(''),
    );
    await writeFile(
      path.join(directory, 'routes.txt'),
      'route_id,route_type\n',
    );
    await writeFile(
      path.join(directory, 'shapes.txt'),
      'excluded invalid input',
    );
    const events: GtfsReportEvent[] = [];
    await importGtfs({
      database: { path: ':memory:' },
      sources: [
        {
          sourceId: 'metro',
          schedule: {
            path: directory,
            excludeFiles: ['shapes.txt'],
            import: {
              validation: {
                onUnknownField: useDirectImport ? 'preserve' : 'discard',
              },
            },
          },
        },
      ],
      reporting: { reporter: (event) => events.push(event) },
    });
    const preparation = events.filter(
      (
        event,
      ): event is Extract<GtfsReportEvent, { type: 'progress' | 'status' }> =>
        (event.type === 'progress' || event.type === 'status') &&
        event.progressBar === false,
    );
    assert.ok(preparation.every((event) => event.sourceId === 'metro'));
    const updates = preparation.filter(
      (event): event is Extract<GtfsReportEvent, { type: 'progress' }> =>
        event.type === 'progress' && event.filename === 'stops.txt',
    );
    assert.ok(
      updates.some((event) => event.current! > 0 && event.current! < 1200),
    );
    assert.ok(updates.every((event) => event.total === undefined));
    assert.ok(
      updates.every(
        (event, index) =>
          index === 0 || event.current! >= updates[index - 1]!.current!,
      ),
    );
    const completed = preparation.filter(
      (event) => event.type === 'status' && event.phase === 'complete',
    );
    assert.deepEqual(
      completed.map((event) => event.message),
      ['agency.txt — 1 row', 'routes.txt — 0 rows', 'stops.txt — 1,200 rows'],
    );
    const importIndex = events.findIndex(
      (event) => event.message === 'Importing GTFS files',
    );
    assert.ok(
      completed.every((event) =>
        useDirectImport
          ? events.indexOf(event) > importIndex
          : events.indexOf(event) < importIndex,
      ),
    );
    assert.ok(
      !events.some((event) =>
        event.message.includes('references between files'),
      ),
    );
  });
}

test('validation reports reference checking after scanning files', async () => {
  const events: GtfsReportEvent[] = [];
  await importGtfs({
    database: { path: ':memory:' },
    sources: [
      {
        schedule: {
          path: 'test/fixtures/complete',
          import: { validation: { mode: 'strict' } },
        },
      },
    ],
    reporting: { reporter: (event) => events.push(event) },
  });
  const start = events.findIndex(
    (event) => event.message === 'Checking references between files',
  );
  const end = events.findIndex(
    (event) => event.message === 'Checked references between files',
  );
  assert.ok(start > 0 && end > start);
  assert.ok(
    events
      .filter(
        (event) =>
          event.type === 'status' &&
          event.progressBar === false &&
          event.filename !== undefined,
      )
      .every((event) => events.indexOf(event) < start),
  );
  assert.ok(
    end < events.findIndex((event) => event.message === 'Importing GTFS files'),
  );
});

for (const transport of ['declared', 'unknown', 'encoded'] as const) {
  test(`reports downloaded bytes with ${transport} length`, async (t) => {
    const archive = encodeZipFixture([
      { name: 'agency.txt', content: 'agency_id,agency_name\nagency,Agency\n' },
    ]);
    const headers: Record<string, string> = {};
    if (transport !== 'unknown') {
      headers['content-length'] = String(archive.byteLength);
    }
    if (transport === 'encoded') {
      headers['content-encoding'] = 'gzip';
    }
    // Fetch returns the decoded body even when Content-Length is its wire size.
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response(archive, { headers }),
    );
    const events: GtfsReportEvent[] = [];
    const config = resolveGtfsImportConfig({
      database: { path: ':memory:' },
      sources: [
        {
          schedule: {
            url: 'https://example.test/feed.zip?token=secret&agency=metro',
          },
        },
      ],
      reporting: { reporter: (event: GtfsReportEvent) => events.push(event) },
    });
    const source = config.sources[0];
    assert.ok(source);
    const prepared = await prepareScheduleSource({
      source,
      reporting: config.reporting,
    });
    t.after(() => prepared.cleanup());
    const updates = events.filter((event) => event.type === 'progress');
    assert.ok(updates.length > 0);
    assert.equal(updates.at(-1)?.current, archive.byteLength);
    assert.equal(
      updates.at(-1)?.total,
      transport === 'declared' ? archive.byteLength : undefined,
    );
    assert.ok(!JSON.stringify(events).includes('secret'));
    assert.match(events[0]?.message ?? '', /token=\*\*\*&agency=metro/u);
    assert.equal(events.at(-1)?.type, 'status');
  });
}

test('staged import progress includes source, file, and row totals', async () => {
  const events: GtfsReportEvent[] = [];
  await importGtfs({
    database: { path: ':memory:' },
    sources: [
      {
        sourceId: 'metro',
        schedule: {
          path: 'test/fixtures/complete',
          import: { validation: { onUnknownField: 'discard' } },
        },
      },
    ],
    reporting: { reporter: (event) => events.push(event) },
  });
  const updates = events.filter(
    (event) =>
      event.type === 'progress' &&
      event.operation === 'import' &&
      event.progressBar !== false,
  );
  assert.ok(updates.length > 0);
  for (const event of updates) {
    assert.equal(event.type, 'progress');
    assert.equal(event.sourceId, 'metro');
    assert.equal(typeof event.filename, 'string');
    assert.ok(Number.isSafeInteger(event.current));
    assert.ok(Number.isSafeInteger(event.total));
    assert.ok(
      events.some(
        (completion) =>
          completion.type === 'status' &&
          completion.progressBar !== false &&
          completion.phase === 'complete' &&
          completion.filename === event.filename &&
          completion.sourceId === 'metro',
      ),
    );
  }
});
