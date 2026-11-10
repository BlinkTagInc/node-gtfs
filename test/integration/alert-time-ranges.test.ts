import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Database from 'better-sqlite3';
import { encodeRealtimeFeed } from '../helpers/realtime-feed.ts';
import { Gtfs, GtfsValidationNoticeCode } from '../../src/index.ts';

function alert(id: string, periods: Record<string, unknown>) {
  return {
    id,
    alert: {
      ...periods,
      headerText: { translation: [{ text: id }] },
      descriptionText: { translation: [{ text: `${id} description` }] },
    },
  };
}
describe('queryable GTFS Realtime alert time ranges', () => {
  const sqlite = new Database(':memory:');
  const originalFetch = globalThis.fetch;
  let payload = encodeRealtimeFeed({
    incrementality: 'FULL_DATASET',
    timestamp: 1,
    entities: [
      alert('modern', {
        activePeriod: [{ start: 1, end: 2 }],
        communicationPeriod: [{ start: 100, end: 200 }, { start: 300 }],
        impactPeriod: [
          { start: 120, end: 150 },
          { start: 310, end: 320 },
        ],
      }),
      alert('legacy', {
        activePeriod: [{ start: 50, end: 60 }],
      }),
      alert('open', {
        communicationPeriod: [{ end: 100 }],
        impactPeriod: [{ end: 80 }],
      }),
      alert('invalid', {
        communicationPeriod: [{ start: 500, end: 400 }],
        impactPeriod: [{ start: 450, end: 460 }],
      }),
    ],
  });
  const gtfs = new Gtfs({
    database: { client: sqlite },
    sources: [
      {
        sourceId: 'period-source',
        realtime: {
          feeds: [
            {
              feedId: 'alerts',
              url: 'https://example.test/alerts.pb',
            },
          ],
        },
      },
    ],
    reporting: { level: 'silent' },
    extensions: ['gtfs-realtime'],
  });
  before(async () => {
    globalThis.fetch = (async () =>
      new Response(payload, {
        status: 200,
        headers: { 'Content-Type': 'application/x-protobuf' },
      })) as typeof fetch;
    await gtfs.schema.recreate();
  });
  after(async () => {
    globalThis.fetch = originalFetch;
    await gtfs.close();
    sqlite.close();
  });
  test('stores every modern, legacy, multiple, open, and malformed range', async () => {
    const report = await gtfs.realtime.refresh();
    assert.equal(
      report.validation.samples.some(
        (notice) =>
          notice.code ===
          GtfsValidationNoticeCode.REALTIME_ALERT_PERIOD_INVALID,
      ),
      true,
    );
    assert.equal(
      report.validation.samples.some(
        (notice) =>
          notice.code ===
          GtfsValidationNoticeCode.REALTIME_ALERT_IMPACT_NOT_CONTAINED,
      ),
      true,
    );
    const rows = await gtfs.realtime.alertTimeRanges
      .select(
        'alert_id',
        'range_kind',
        'range_ordinal',
        'start_unix_seconds',
        'end_unix_seconds',
        'is_valid',
      )
      .orderBy([
        { field: 'alert_id', direction: 'asc' },
        { field: 'range_kind', direction: 'asc' },
        { field: 'range_ordinal', direction: 'asc' },
      ])
      .all();
    assert.equal(rows.length, 10);
    assert.deepEqual(
      rows.filter((row) => row.alert_id === 'modern'),
      [
        {
          alert_id: 'modern',
          range_kind: 'active',
          range_ordinal: 0,
          start_unix_seconds: 1,
          end_unix_seconds: 2,
          is_valid: 1,
        },
        {
          alert_id: 'modern',
          range_kind: 'communication',
          range_ordinal: 0,
          start_unix_seconds: 100,
          end_unix_seconds: 200,
          is_valid: 1,
        },
        {
          alert_id: 'modern',
          range_kind: 'communication',
          range_ordinal: 1,
          start_unix_seconds: 300,
          end_unix_seconds: null,
          is_valid: 1,
        },
        {
          alert_id: 'modern',
          range_kind: 'impact',
          range_ordinal: 0,
          start_unix_seconds: 120,
          end_unix_seconds: 150,
          is_valid: 1,
        },
        {
          alert_id: 'modern',
          range_kind: 'impact',
          range_ordinal: 1,
          start_unix_seconds: 310,
          end_unix_seconds: 320,
          is_valid: 1,
        },
      ],
    );
    assert.deepEqual(
      rows.find(
        (row) =>
          row.alert_id === 'invalid' && row.range_kind === 'communication',
      ),
      {
        alert_id: 'invalid',
        range_kind: 'communication',
        range_ordinal: 0,
        start_unix_seconds: 500,
        end_unix_seconds: 400,
        is_valid: 0,
      },
    );
    assert.equal(
      rows.find(
        (row) => row.alert_id === 'invalid' && row.range_kind === 'impact',
      )?.is_valid,
      0,
    );
    const storedAlert = sqlite
      .prepare(
        `select active_period, communication_period, impact_period
         from alerts where entity_id = 'modern'`,
      )
      .get() as Record<string, string>;
    assert.equal(JSON.parse(storedAlert.active_period!).length, 1);
    assert.equal(JSON.parse(storedAlert.communication_period!).length, 2);
    assert.equal(JSON.parse(storedAlert.impact_period!).length, 2);
    const serviceAlertColumns = sqlite
      .prepare(`pragma table_info('alerts')`)
      .all()
      .map(
        (column) =>
          (
            column as {
              name: string;
            }
          ).name,
      );
    assert.equal(serviceAlertColumns.includes('start_time'), false);
    assert.equal(serviceAlertColumns.includes('end_time'), false);
  });
  test('uses half-open containment and active-only compatibility fallback', async () => {
    const idsAt = async (
      field: 'communicationActiveAt' | 'impactActiveAt',
      timestamp: number,
    ) =>
      (
        await gtfs.realtime.alerts
          .where({ [field]: timestamp })
          .select('entity_id')
          .orderBy([{ field: 'entity_id', direction: 'asc' }])
          .all()
      ).map(({ entity_id }) => entity_id);
    assert.deepEqual(await idsAt('communicationActiveAt', 100), ['modern']);
    assert.deepEqual(await idsAt('communicationActiveAt', 200), []);
    assert.deepEqual(await idsAt('communicationActiveAt', 300), ['modern']);
    assert.deepEqual(await idsAt('impactActiveAt', 149), ['modern']);
    assert.deepEqual(await idsAt('impactActiveAt', 150), []);
    assert.deepEqual(await idsAt('communicationActiveAt', 55), [
      'legacy',
      'open',
    ]);
    assert.deepEqual(await idsAt('impactActiveAt', 55), ['legacy', 'open']);
    assert.deepEqual(await idsAt('communicationActiveAt', 1), ['open']);
    assert.deepEqual(await idsAt('impactActiveAt', 310), ['modern']);
    assert.deepEqual(await idsAt('communicationActiveAt', 450), ['modern']);
    assert.deepEqual(await idsAt('impactActiveAt', 455), []);
    await assert.rejects(
      async () =>
        gtfs.realtime.alerts
          .where({ communicationActiveAt: [100, 200] } as never)
          .all(),
      /must be a non-negative Unix timestamp in seconds/,
    );
  });
  test('deletes period children on differential tombstones', async () => {
    payload = encodeRealtimeFeed({
      incrementality: 'DIFFERENTIAL',
      timestamp: 1,
      entities: [{ id: 'modern', isDeleted: true }],
    });
    await gtfs.realtime.refresh();
    assert.equal(
      await gtfs.realtime.alertTimeRanges.where({ alert_id: 'modern' }).count(),
      0,
    );
    assert.equal(
      await gtfs.realtime.alerts.where({ entity_id: 'modern' }).count(),
      0,
    );
    assert.equal(
      await gtfs.realtime.persistence.feedEntities
        .where({ entity_id: 'modern' })
        .count(),
      2,
    );
  });
});
