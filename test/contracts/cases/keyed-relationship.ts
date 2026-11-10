import assert from 'node:assert/strict';
import { Kysely, sql } from 'kysely';
import { Gtfs, type GtfsImportOptions } from '../../../src/index.ts';
import { digestGtfsCanonicalKey } from '../../../src/database/storage/key.ts';
import {
  integerText,
  safeInteger,
} from '../../helpers/advanced-summary-recipes.ts';
import {
  scheduleRelationshipCases,
  flexRelationshipCases,
  realtimeRelationshipCases,
} from '../../helpers/relationship-query-cases.ts';

export async function verifyScheduleRelationshipQueries(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const gtfs = new Gtfs({
    database,
    sources: [{ sourceId: 'north' }],
    extensions: ['gtfs-realtime'],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`insert into routes
            (source_id, route_id, route_short_name, route_type)
            values
              ('north', 'red', 'Red', 1),
              ('north', 'blue', 'Blue', 1),
              ('north', 'ghost', 'Ghost', 1)`.execute(db);
        await sql`insert into trips
            (source_id, route_id, service_id, trip_id, direction_id, shape_id)
            values
              ('north', 'red', 'weekday', 'red-trip', 0, 'red-shape'),
              ('north', 'red', 'weekday', 'red-trip-2', 0, 'red-shape'),
              ('north', 'blue', 'weekend', 'blue-trip', 1, 'blue-shape'),
              ('south', 'ghost', 'weekday', 'ghost-trip', 0, 'red-shape')`.execute(
          db,
        );
        await sql`insert into stops
            (source_id, stop_id, stop_name, stop_lat, stop_lon, location_type)
            values
              ('north', 'red-stop', 'Red stop', 37, -122, 0),
              ('north', 'blue-stop', 'Blue stop', 38, -123, 0)`.execute(db);
        for (const [sourceId, tripId, stopId, arrival, departure, seconds] of [
          ['north', 'red-trip', 'red-stop', '09:00:00', '09:01:00', 32400],
          ['north', 'red-trip-2', 'red-stop', '09:02:00', '09:03:00', 32520],
          ['north', 'blue-trip', 'blue-stop', '10:00:00', '10:01:00', 36000],
          ['south', 'ghost-trip', 'red-stop', '11:00:00', '11:01:00', 39600],
        ] as const) {
          await db
            .insertInto('stop_times')
            .values({
              source_id: sourceId,
              trip_id: tripId,
              stop_id: stopId,
              stop_sequence: 1,
              arrival_time: arrival,
              departure_time: departure,
              // Native SQLite generates these columns; portable adapters store
              // values normally supplied by the importer.
              ...(database.client instanceof Kysely
                ? {
                    arrival_service_day_seconds: seconds,
                    departure_service_day_seconds: seconds + 60,
                  }
                : {}),
            })
            .execute();
        }
        await sql`insert into shapes
            (source_id, shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
            values
              ('north', 'red-shape', 37, -122, 1),
              ('north', 'blue-shape', 38, -123, 1)`.execute(db);
        await sql`insert into calendar
            (source_id, service_id, monday, tuesday, wednesday, thursday,
             friday, saturday, sunday, start_date, end_date)
            values
              ('north', 'weekday', 0, 0, 1, 0, 0, 0, 0, 20260101, 20261231),
              ('north', 'weekend', 0, 0, 0, 0, 0, 1, 1, 20260101, 20261231)`.execute(
          db,
        );
        await sql`insert into alerts
            (source_id, realtime_feed_id, entity_id, header_text, description_text,
             created_at_unix_seconds, expires_at_unix_seconds)
            values ('north', 'alerts', 'red-alert', 'Red alert', 'Delayed', 1, 2)`.execute(
          db,
        );
        await sql`insert into alert_entity_selectors
            (source_id, realtime_feed_id, alert_id, selector_ordinal, route_id,
             stop_id, created_at_unix_seconds, expires_at_unix_seconds)
            values
              ('north', 'alerts', 'red-alert', 0, 'red', 'blue-stop', 1, 2),
              ('north', 'alerts', 'red-alert', 1, 'blue', 'red-stop', 1, 2)`.execute(
          db,
        );
      },
    });

    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const [name, query, expected] of scheduleRelationshipCases(
          db,
          'north',
        )) {
          assert.deepEqual(await query.execute(), expected, name);
          const total = await sql<{
            total: string;
          }>`select ${integerText(sql`count(*)`, gtfs.database.dialect)} as total from (${query}) as matching`.execute(
            db,
          );
          assert.equal(
            safeInteger(total.rows[0]!.total),
            expected.length,
            name,
          );
        }
      },
    });
    assert.deepEqual(
      await gtfs.query
        .stopsForRoute({ routeId: 'blue' })
        .select('stop_id')
        .all(),
      [{ stop_id: 'blue-stop' }],
    );
    assert.deepEqual(
      await gtfs.query
        .activeTrips({ serviceDate: 20260826 })
        .select('trip_id')
        .orderBy([{ field: 'trip_id' }])
        .all(),
      [{ trip_id: 'red-trip' }, { trip_id: 'red-trip-2' }],
    );
    assert.deepEqual(
      await gtfs.query
        .stopTimes({
          serviceDate: 20260826,
          routeId: 'red',
          window: { field: 'arrival_time', start: '08:59:00', end: '09:02:00' },
        })
        .select('trip_id', 'arrival_service_day_seconds')
        .orderBy([{ field: 'trip_id' }])
        .all(),
      // Domain windows have an exclusive end; the SQL case above preserves <=.
      [{ trip_id: 'red-trip', arrival_service_day_seconds: 32400 }],
    );
  } finally {
    await gtfs.close();
  }
}

export async function verifyFlexRelationshipQueries(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const gtfs = new Gtfs({
    database,
    sources: [{ sourceId: 'north' }],
    extensions: ['gtfs-realtime'],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`insert into agency
            (source_id, agency_id, agency_name, agency_url, agency_timezone,
             _node_gtfs_key)
            values ('north', 'metro', 'Metro', 'https://example.com', 'UTC',
              ${digestGtfsCanonicalKey(['north', 'metro'])})`.execute(db);
        await sql`insert into routes
            (source_id, route_id, agency_id, route_type)
            values ('north', 'red', 'metro', 1)`.execute(db);
        await sql`insert into networks (source_id, network_id, network_name)
            values ('north', 'rail', 'Rail')`.execute(db);
        await sql`insert into route_networks
            (source_id, network_id, route_id)
            values ('north', 'rail', 'red')`.execute(db);
        await sql`insert into levels
            (source_id, level_id, level_index, level_name)
            values ('north', 'mezzanine', 1, 'Mezzanine')`.execute(db);
        await sql`insert into stops
            (source_id, stop_id, stop_name, location_type, parent_station, level_id)
            values
              ('north', 'station', 'Station', 1, null, 'mezzanine'),
              ('north', 'platform-1', 'Platform 1', 0, 'station', 'mezzanine'),
              ('north', 'platform-2', 'Platform 2', 0, 'station', 'mezzanine')`.execute(
          db,
        );
        await sql`insert into areas (source_id, area_id, area_name)
            values ('north', 'paid-area', 'Paid area')`.execute(db);
        await sql`insert into stop_areas (source_id, area_id, stop_id)
            values ('north', 'paid-area', 'platform-1')`.execute(db);
        await sql`insert into location_groups
            (source_id, location_group_id, location_group_name)
            values ('north', 'flex-group', 'Flex group')`.execute(db);
        await sql`insert into location_group_stops
            (source_id, location_group_id, stop_id)
            values ('north', 'flex-group', 'platform-1')`.execute(db);
        await sql`insert into trips
            (source_id, route_id, service_id, trip_id)
            values ('north', 'red', 'weekday', 'red-trip')`.execute(db);
        await sql`insert into frequencies
            (source_id, trip_id, start_time, end_time, headway_secs)
            values ('north', 'red-trip', '08:00:00', '09:00:00', 600)`.execute(
          db,
        );
        await sql`insert into locations (source_id, id, stop_name, geometry)
            values ('north', 'zone-1', 'Zone 1', '{}')`.execute(db);
        await sql`insert into booking_rules
            (source_id, booking_rule_id, booking_type)
            values
              ('north', 'pickup-rule', 0),
              ('north', 'drop-rule', 0)`.execute(db);
        await sql`insert into stop_times
            (source_id, trip_id, stop_sequence, stop_id, location_id,
             location_group_id, pickup_booking_rule_id,
             drop_off_booking_rule_id)
            values
              ('north', 'red-trip', 1, 'platform-1', 'zone-1', 'flex-group',
               'pickup-rule', 'drop-rule')`.execute(db);
        await sql`insert into pathways
            (source_id, pathway_id, from_stop_id, to_stop_id,
             pathway_mode, is_bidirectional)
            values
              ('north', 'walkway', 'platform-1', 'platform-2', 1, 1)`.execute(
          db,
        );
      },
    });

    await gtfs.database.withKysely({
      callback: async (db) => {
        for (const [name, query, expected] of flexRelationshipCases(
          db,
          'north',
        )) {
          assert.deepEqual(await query.execute(), expected, name);
          const total = await sql<{
            total: string;
          }>`select ${integerText(sql`count(*)`, gtfs.database.dialect)} as total from (${query}) as matching`.execute(
            db,
          );
          assert.equal(
            safeInteger(total.rows[0]!.total),
            expected.length,
            name,
          );
        }
        const cases = flexRelationshipCases(db, 'north');
        for (const [name, move, restore, affected] of [
          [
            'route',
            db
              .updateTable('routes')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('routes')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [0, 1],
          ],
          [
            'network junction',
            db
              .updateTable('route_networks')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('route_networks')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [0, 1],
          ],
          [
            'network',
            db
              .updateTable('networks')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('networks')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [0],
          ],
          [
            'parent station',
            db
              .updateTable('stops')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north')
              .where('stop_id', '=', 'station'),
            db
              .updateTable('stops')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [2],
          ],
          [
            'area membership',
            db
              .updateTable('stop_areas')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('stop_areas')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [2, 8],
          ],
          [
            'area',
            db
              .updateTable('areas')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('areas')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [2],
          ],
          [
            'location-group membership',
            db
              .updateTable('location_group_stops')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('location_group_stops')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [2, 9],
          ],
          [
            'location group',
            db
              .updateTable('location_groups')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('location_groups')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [2, 6],
          ],
          [
            'child level',
            db
              .updateTable('levels')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('levels')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [3],
          ],
          [
            'frequency',
            db
              .updateTable('frequencies')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('frequencies')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [4],
          ],
          [
            'trip',
            db
              .updateTable('trips')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('trips')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [5],
          ],
          [
            'Flex location',
            db
              .updateTable('locations')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('locations')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [6],
          ],
          [
            'pickup rule',
            db
              .updateTable('booking_rules')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north')
              .where('booking_rule_id', '=', 'pickup-rule'),
            db
              .updateTable('booking_rules')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [6],
          ],
          [
            'drop-off rule',
            db
              .updateTable('booking_rules')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north')
              .where('booking_rule_id', '=', 'drop-rule'),
            db
              .updateTable('booking_rules')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [6],
          ],
          [
            'platform',
            db
              .updateTable('stops')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north')
              .where('stop_id', '=', 'platform-1'),
            db
              .updateTable('stops')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [7, 8, 9],
          ],
        ] as const) {
          await move.execute();
          try {
            for (const index of affected) {
              const [queryName, query] = cases[index];
              assert.deepEqual(
                await query.execute(),
                [],
                `${queryName}: ignore foreign-source ${name}`,
              );
            }
          } finally {
            await restore.execute();
          }
        }
      },
    });
  } finally {
    await gtfs.close();
  }
}

export async function verifyRealtimeRelationshipQueries(
  database: GtfsImportOptions['database'],
): Promise<void> {
  const gtfs = new Gtfs({
    database,
    sources: [{ sourceId: 'north' }],
    extensions: ['gtfs-realtime'],
    reporting: { level: 'silent' },
  });
  try {
    await gtfs.schema.recreate();
    await gtfs.database.withKysely({
      callback: async (db) => {
        await sql`insert into agency
            (source_id, agency_id, agency_name, agency_url, agency_timezone,
             _node_gtfs_key)
            values ('north', 'metro', 'Metro', 'https://example.com', 'UTC',
              ${digestGtfsCanonicalKey(['north', 'metro'])})`.execute(db);
        await sql`insert into routes
            (source_id, route_id, agency_id, route_type)
            values ('north', 'red', 'metro', 1)`.execute(db);
        await sql`insert into trips
            (source_id, route_id, service_id, trip_id)
            values ('north', 'red', 'weekday', 'scheduled-trip')`.execute(db);
        await sql`insert into stops (source_id, stop_id, stop_name)
            values ('north', 'platform-1', 'Platform 1')`.execute(db);
        await sql`insert into realtime_feeds
            (source_id, realtime_feed_id, feed_type, feed_url,
             created_at_unix_seconds, updated_at_unix_seconds)
            values
              ('north', 'live', 'mixed', 'https://example.com/live', 1, 1),
              ('north', 'orphan', 'mixed', 'https://example.com/orphan', 1, 1)`.execute(
          db,
        );
        await sql`insert into realtime_snapshots
            (source_id, realtime_feed_id, snapshot_id, fetched_at_unix_seconds,
             entity_count, payload_sha256, raw_payload, raw_payload_encoding)
            values
              ('north', 'live', 'snapshot-1', 10, 1, 'north-hash', 'AA==', 'base64'),
              ('south', 'orphan', 'snapshot-1', 10, 1, 'south-hash', 'AA==', 'base64')`.execute(
          db,
        );
        await sql`insert into realtime_feed_entities
            (source_id, realtime_feed_id, snapshot_id, entity_ordinal, entity_id,
             entity_type, is_deleted, entity_json, recorded_at_unix_seconds)
            values
              ('north', 'live', 'snapshot-1', 0, 'entity-1', 'trip_update', 0, '{}', 10),
              ('south', 'orphan', 'snapshot-1', 0, 'entity-1', 'trip_update', 0, '{}', 10)`.execute(
          db,
        );
        await sql`insert into trip_updates
            (source_id, realtime_feed_id, entity_id, trip_id, route_id,
             created_at_unix_seconds, expires_at_unix_seconds)
            values ('north', 'live', 'update-1', 'scheduled-trip', 'red', 10, 20)`.execute(
          db,
        );
        await sql`insert into trip_update_stop_time_updates
            (source_id, realtime_feed_id, trip_update_id,
             stop_time_update_ordinal, trip_id, route_id, stop_id,
             created_at_unix_seconds, expires_at_unix_seconds)
            values
              ('north', 'live', 'update-1', 0, 'scheduled-trip', 'red',
               'platform-1', 10, 20)`.execute(db);
        await sql`insert into vehicle_positions
            (source_id, realtime_feed_id, entity_id, trip_id, route_id, stop_id,
             created_at_unix_seconds, expires_at_unix_seconds)
            values
              ('north', 'live', 'vehicle-1', 'scheduled-trip', 'red',
               'platform-1', 10, 20)`.execute(db);
        await sql`insert into alerts
            (source_id, realtime_feed_id, entity_id, header_text, description_text,
             created_at_unix_seconds, expires_at_unix_seconds)
            values ('north', 'live', 'alert-1', 'Alert', 'Description', 10, 20)`.execute(
          db,
        );
        await sql`insert into alert_time_ranges
            (source_id, realtime_feed_id, alert_id, range_kind, range_ordinal,
             start_unix_seconds, end_unix_seconds, is_valid,
             created_at_unix_seconds, expires_at_unix_seconds)
            values
              ('north', 'live', 'alert-1', 'impact', 0, 10, 20, 1, 10, 20)`.execute(
          db,
        );
        await sql`insert into alert_entity_selectors
            (source_id, realtime_feed_id, alert_id, selector_ordinal,
             agency_id, route_id, stop_id, trip_id,
             created_at_unix_seconds, expires_at_unix_seconds)
            values
              ('north', 'live', 'alert-1', 0, 'metro', 'red', 'platform-1',
               'scheduled-trip', 10, 20)`.execute(db);
      },
    });

    await gtfs.database.withKysely({
      callback: async (db) => {
        // The same IDs in other sources, feeds and snapshots must not satisfy
        // a relationship or contaminate a negative/exhaustive predicate.
        await sql`insert into realtime_feeds
          (source_id, realtime_feed_id, feed_type, feed_url, created_at_unix_seconds, updated_at_unix_seconds)
          values ('north', 'other', 'mixed', 'https://example.com/other', 1, 1)`.execute(
          db,
        );
        await sql`insert into realtime_snapshots
          (source_id, realtime_feed_id, snapshot_id, fetched_at_unix_seconds, entity_count, payload_sha256, raw_payload, raw_payload_encoding)
          values
            ('north', 'other', 'snapshot-1', 10, 1, 'other-hash', 'AA==', 'base64'),
            ('north', 'live', 'snapshot-2', 10, 1, 'next-hash', 'AA==', 'base64'),
            ('south', 'live', 'snapshot-1', 10, 1, 'south-live-hash', 'AA==', 'base64')`.execute(
          db,
        );
        await sql`insert into realtime_feed_entities
          (source_id, realtime_feed_id, snapshot_id, entity_ordinal, entity_id, entity_type, is_deleted, entity_json, recorded_at_unix_seconds)
          values
            ('north', 'other', 'snapshot-1', 0, 'other-entity', 'alert', 1, '{}', 10),
            ('north', 'live', 'snapshot-2', 0, 'next-entity', 'alert', 1, '{}', 10),
            ('south', 'live', 'snapshot-1', 0, 'south-entity', 'alert', 1, '{}', 10)`.execute(
          db,
        );
        await sql`insert into trip_update_stop_time_updates
          (source_id, realtime_feed_id, trip_update_id, stop_time_update_ordinal, trip_id, route_id, stop_id, created_at_unix_seconds, expires_at_unix_seconds)
          values ('north', 'other', 'update-1', 0, 'scheduled-trip', 'red', 'platform-1', 10, 20)`.execute(
          db,
        );
        await sql`insert into alerts
          (source_id, realtime_feed_id, entity_id, header_text, description_text, created_at_unix_seconds, expires_at_unix_seconds)
          values ('north', 'other', 'alert-1', 'Other alert', 'Other description', 10, 20)`.execute(
          db,
        );
        await sql`insert into alert_time_ranges
          (source_id, realtime_feed_id, alert_id, range_kind, range_ordinal, start_unix_seconds, end_unix_seconds, is_valid, created_at_unix_seconds, expires_at_unix_seconds)
          values ('north', 'other', 'alert-1', 'impact', 0, 10, 20, 1, 10, 20)`.execute(
          db,
        );
        for (const [name, query, expected] of realtimeRelationshipCases(
          db,
          'north',
        )) {
          assert.deepEqual(await query.execute(), expected, name);
          const total = await sql<{
            total: string;
          }>`select ${integerText(sql`count(*)`, gtfs.database.dialect)} as total from (${query}) as matching`.execute(
            db,
          );
          assert.equal(
            safeInteger(total.rows[0]!.total),
            expected.length,
            name,
          );
        }
        const cases = realtimeRelationshipCases(db, 'north');
        assert.deepEqual(
          await cases[1][1].limit(1).offset(0).execute(),
          cases[1][2],
        );
        assert.deepEqual(await cases[1][1].limit(1).offset(1).execute(), []);
        assert.deepEqual(await cases[1][1].limit(0).execute(), []);
        for (const [name, move, restore, affected] of [
          [
            'snapshot entity feed',
            db
              .updateTable('realtime_feed_entities')
              .set({ realtime_feed_id: 'isolated' })
              .where('source_id', '=', 'north')
              .where('entity_id', '=', 'entity-1'),
            db
              .updateTable('realtime_feed_entities')
              .set({ realtime_feed_id: 'live' })
              .where('source_id', '=', 'north')
              .where('realtime_feed_id', '=', 'isolated'),
            [0, 1, 2, 3],
          ],
          [
            'parent update feed',
            db
              .updateTable('trip_updates')
              .set({ realtime_feed_id: 'isolated' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('trip_updates')
              .set({ realtime_feed_id: 'live' })
              .where('source_id', '=', 'north'),
            [4, 5],
          ],
          [
            'alert range feed',
            db
              .updateTable('alert_time_ranges')
              .set({ realtime_feed_id: 'isolated' })
              .where('source_id', '=', 'north')
              .where('realtime_feed_id', '=', 'live'),
            db
              .updateTable('alert_time_ranges')
              .set({ realtime_feed_id: 'live' })
              .where('source_id', '=', 'north')
              .where('realtime_feed_id', '=', 'isolated'),
            [7, 8],
          ],
          [
            'alert selector feed',
            db
              .updateTable('alert_entity_selectors')
              .set({ realtime_feed_id: 'isolated' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('alert_entity_selectors')
              .set({ realtime_feed_id: 'live' })
              .where('source_id', '=', 'north'),
            [7, 8],
          ],
          [
            'scheduled trip source',
            db
              .updateTable('trips')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('trips')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [4, 6, 7],
          ],
          [
            'scheduled route source',
            db
              .updateTable('routes')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('routes')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [4, 5, 6, 7],
          ],
          [
            'scheduled stop source',
            db
              .updateTable('stops')
              .set({ source_id: 'south' })
              .where('source_id', '=', 'north'),
            db
              .updateTable('stops')
              .set({ source_id: 'north' })
              .where('source_id', '=', 'south'),
            [4, 5, 6, 7],
          ],
        ] as const) {
          await move.execute();
          try {
            for (const index of affected) {
              const [queryName, query] = cases[index];
              assert.deepEqual(
                await query.execute(),
                [],
                `${queryName}: ignore ${name} mismatch`,
              );
            }
          } finally {
            await restore.execute();
          }
        }
      },
    });
  } finally {
    await gtfs.close();
  }
}
