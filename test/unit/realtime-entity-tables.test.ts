import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GTFS_REALTIME_ENTITY_TABLES,
  GTFS_REALTIME_CHILD_RELATIONSHIPS,
  GTFS_REALTIME_CURRENT_STATE_TABLES,
} from '../../src/realtime/entity-tables.ts';
import { compiledTables } from '../../src/schema/table-registry.ts';
import {
  normalizeRealtimeEntity,
  normalizeRealtimeDeletion,
} from '../../src/realtime/normalizer.ts';

const context = {
  sourceId: 'source',
  realtimeFeedId: 'feed',
  nowUnixSeconds: 10,
  expiresAtUnixSeconds: 70,
};

for (const [entityType, parent, children] of [
  [
    'alert',
    'alerts',
    [
      ['alert_entity_selectors', 'alert_id'],
      ['alert_time_ranges', 'alert_id'],
    ],
  ],
  [
    'trip_update',
    'trip_updates',
    [['trip_update_stop_time_updates', 'trip_update_id']],
  ],
  ['vehicle_position', 'vehicle_positions', []],
  ['shape', 'realtime_shapes', []],
  ['stop', 'realtime_stops', []],
  ['trip_modifications', 'trip_modifications', []],
] as const) {
  test(`${entityType} uses the same parent and scoped children for replacement and deletion`, () => {
    assert.equal(GTFS_REALTIME_ENTITY_TABLES[entityType].tableName, parent);
    assert.deepEqual(
      GTFS_REALTIME_CHILD_RELATIONSHIPS.filter(
        (relation) => relation.parent.tableName === parent,
      ).map((relation) => [relation.child.tableName, relation.entityIdColumn]),
      children,
    );
    const replacement = normalizeRealtimeEntity({
      entityType,
      entity: { id: 'shared' },
      context,
      alertPeriods: [],
    });
    const deletion = normalizeRealtimeDeletion(entityType, 'shared', context);
    assert.deepEqual(
      deletion.map((mutation) => {
        assert.ok(mutation.operation === 'delete');
        return { table: mutation.table.tableName, where: mutation.where };
      }),
      [...children, [parent, 'entity_id']].map(([table, field]) => ({
        table,
        where: [
          { field: 'source_id', value: 'source' },
          { field: 'realtime_feed_id', value: 'feed' },
          { field, value: 'shared' },
        ],
      })),
    );
    assert.deepEqual(
      replacement.filter(({ operation }) => operation === 'delete'),
      deletion.slice(0, -1),
    );
    const parentRow = replacement.at(-1);
    assert.ok(parentRow?.operation === 'replace');
    assert.equal(parentRow.table.tableName, parent);
    assert.equal(parentRow.row.entity_id, 'shared');
    assert.equal(parentRow.row.source_id, 'source');
    assert.equal(parentRow.row.realtime_feed_id, 'feed');
  });
}

test('Realtime table metadata is immutable and covers every expiring current table', () => {
  assert.ok(Object.isFrozen(GTFS_REALTIME_ENTITY_TABLES));
  assert.ok(Object.isFrozen(GTFS_REALTIME_CHILD_RELATIONSHIPS));
  assert.ok(Object.isFrozen(GTFS_REALTIME_CURRENT_STATE_TABLES));
  assert.equal(
    new Set(GTFS_REALTIME_CURRENT_STATE_TABLES).size,
    GTFS_REALTIME_CURRENT_STATE_TABLES.length,
  );
  assert.deepEqual(
    [...GTFS_REALTIME_CURRENT_STATE_TABLES].sort(),
    compiledTables
      .filter(
        (table) =>
          table.specification === 'gtfs-realtime' &&
          table.columns.some(({ name }) => name === 'expires_at_unix_seconds'),
      )
      .map(({ tableName }) => tableName)
      .sort(),
  );
  for (const relationship of GTFS_REALTIME_CHILD_RELATIONSHIPS) {
    assert.ok(Object.isFrozen(relationship));
    assert.ok(
      relationship.child.columns.some(
        ({ name }) => name === relationship.entityIdColumn,
      ),
    );
    assert.ok(
      relationship.parent.columns.some(({ name }) => name === 'entity_id'),
    );
    assert.ok(
      GTFS_REALTIME_CURRENT_STATE_TABLES.indexOf(relationship.child.tableName) <
        GTFS_REALTIME_CURRENT_STATE_TABLES.indexOf(
          relationship.parent.tableName,
        ),
    );
  }
});
