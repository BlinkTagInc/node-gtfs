import assert from 'node:assert/strict';
import fc from 'fast-check';
import { Gtfs } from '../../../src/index.ts';
import type { GtfsDatabaseConfig } from '../../../src/types/config.ts';
import { encodeRealtimeFeed } from '../../helpers/realtime-feed.ts';
import { propertyOptions } from '../../helpers/property-options.ts';

const scopes = [
  { sourceId: 'north', feedId: 'primary' },
  { sourceId: 'north', feedId: 'secondary' },
  { sourceId: 'south', feedId: 'primary' },
] as const;
const entity = fc.record({
  id: fc.constantFrom('a', 'b', 'c'),
  deleted: fc.boolean(),
  text: fc.constantFrom('Old', 'New', '東京', '"quoted"'),
  stops: fc.uniqueArray(fc.constantFrom('one', 'two', 'three'), {
    maxLength: 3,
  }),
});
const action = fc.record({
  scope: fc.integer({ min: 0, max: scopes.length - 1 }),
  full: fc.boolean(),
  entities: fc.uniqueArray(entity, {
    selector: (value) => value.id,
    maxLength: 3,
  }),
});
type Entity = { id: string; deleted: boolean; text: string; stops: string[] };
type Action = { scope: number; full: boolean; entities: Entity[] };
const initial = {
  id: 'a',
  deleted: false,
  text: 'Initial',
  stops: ['one', 'two'],
};
const prelude: Action[] = scopes.map((_, scope) => ({
  scope,
  full: true,
  entities: [initial],
}));

function sortedRows(rows: readonly Record<string, unknown>[]) {
  return rows
    .map((value) =>
      JSON.stringify(
        Object.keys(value)
          .sort()
          .map((key) => [key, value[key]]),
      ),
    )
    .sort();
}

export async function verifyRealtimeProperties<DB>(
  database: GtfsDatabaseConfig<DB>,
) {
  const gtfs = new Gtfs({
    database,
    extensions: ['gtfs-realtime'],
    reporting: { level: 'silent' },
  });
  const originalFetch = globalThis.fetch;
  let payload: Buffer = Buffer.alloc(0);
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'https://property.example/feed.pb');
    return new Response(payload);
  };
  try {
    await fc.assert(
      fc.asyncProperty(
        fc.array(action, { minLength: 1, maxLength: 8 }),
        async (actions) => {
          await gtfs.schema.recreate();
          const model = scopes.map(() => new Map<string, Entity>());
          let timestamp = 0;
          for (const step of [...prelude, ...actions]) {
            const scope = scopes[step.scope]!;
            const expected = model[step.scope]!;
            payload = encodeRealtimeFeed({
              incrementality: step.full ? 'FULL_DATASET' : 'DIFFERENTIAL',
              timestamp: ++timestamp,
              entities: step.entities.map((value) =>
                value.deleted
                  ? { id: value.id, isDeleted: true }
                  : {
                      id: value.id,
                      alert: {
                        headerText: { translation: [{ text: value.text }] },
                        descriptionText: {
                          translation: [{ text: value.text }],
                        },
                        informedEntity: value.stops.map((stopId) => ({
                          stopId,
                        })),
                      },
                    },
              ),
            });
            await gtfs.realtime.refresh({
              sources: [
                {
                  sourceId: scope.sourceId,
                  realtime: {
                    feeds: [
                      {
                        feedId: scope.feedId,
                        type: 'alerts',
                        url: 'https://property.example/feed.pb',
                      },
                    ],
                  },
                },
              ],
              retention: {
                currentEntitiesSeconds: 86_400,
                snapshotsSeconds: null,
              },
            });
            // Independent state model: full replaces one feed; differential edits it.
            if (step.full) {
              expected.clear();
            }
            for (const value of step.entities) {
              if (value.deleted) {
                expected.delete(value.id);
              } else {
                expected.set(value.id, value);
              }
            }
            const alerts = model.flatMap((entries, index) =>
              [...entries.values()].map((value) => ({
                source_id: scopes[index]!.sourceId,
                realtime_feed_id: scopes[index]!.feedId,
                entity_id: value.id,
                header_text: value.text,
              })),
            );
            const selectors = model.flatMap((entries, index) =>
              [...entries.values()].flatMap((value) =>
                value.stops.map((stop) => ({
                  source_id: scopes[index]!.sourceId,
                  realtime_feed_id: scopes[index]!.feedId,
                  alert_id: value.id,
                  stop_id: stop,
                })),
              ),
            );
            assert.deepEqual(
              sortedRows(
                await gtfs.realtime.alerts
                  .select(
                    'source_id',
                    'realtime_feed_id',
                    'entity_id',
                    'header_text',
                  )
                  .all(),
              ),
              sortedRows(alerts),
            );
            assert.deepEqual(
              sortedRows(
                await gtfs.realtime.alertEntitySelectors
                  .select(
                    'source_id',
                    'realtime_feed_id',
                    'alert_id',
                    'stop_id',
                  )
                  .all(),
              ),
              sortedRows(selectors),
            );
            assert.equal(
              await gtfs.realtime.persistence.snapshots.count(),
              timestamp,
            );
          }
        },
      ),
      {
        ...propertyOptions(13007, 12),
        examples: [
          [
            [
              {
                scope: 0,
                full: false,
                entities: [{ ...initial, text: 'Replaced', stops: [] }],
              },
              {
                scope: 1,
                full: false,
                entities: [{ ...initial, deleted: true }],
              },
              { scope: 2, full: true, entities: [] },
              {
                scope: 0,
                full: false,
                entities: [{ ...initial, deleted: true }],
              },
            ],
          ],
        ],
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    await gtfs.close();
  }
}
