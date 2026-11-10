import type { Kysely } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import { activeTripKeys } from './advanced-filter-recipes.ts';

// Concrete application queries with explicit source/feed keys. These cases
// replace the named-relationship reader fixtures, not the relationship DSL.
export function scheduleRelationshipCases(
  db: Kysely<GtfsDatabase>,
  sourceId: string,
) {
  const routes = db
    .selectFrom('routes')
    .where('source_id', '=', sourceId)
    .select('route_id');
  return [
    [
      'routes serving a stop',
      routes.where((eb) =>
        eb.exists(
          eb
            .selectFrom('trips')
            .innerJoin('stop_times as time', (join) =>
              join
                .onRef('time.source_id', '=', 'trips.source_id')
                .onRef('time.trip_id', '=', 'trips.trip_id'),
            )
            .whereRef('trips.source_id', '=', 'routes.source_id')
            .whereRef('trips.route_id', '=', 'routes.route_id')
            .where('time.stop_id', '=', 'red-stop')
            .select('trips.trip_id'),
        ),
      ),
      [{ route_id: 'red' }],
    ],
    [
      'routes with no weekday trips',
      routes
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('trips')
                .whereRef('trips.source_id', '=', 'routes.source_id')
                .whereRef('trips.route_id', '=', 'routes.route_id')
                .where('service_id', '=', 'weekday')
                .select('trip_id'),
            ),
          ),
        )
        .orderBy('route_id'),
      [{ route_id: 'blue' }, { route_id: 'ghost' }],
    ],
    [
      'every trip is weekday, including empty routes',
      routes
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('trips')
                .whereRef('trips.source_id', '=', 'routes.source_id')
                .whereRef('trips.route_id', '=', 'routes.route_id')
                .where('service_id', '!=', 'weekday')
                .select('trip_id'),
            ),
          ),
        )
        .orderBy('route_id'),
      [{ route_id: 'ghost' }, { route_id: 'red' }],
    ],
    [
      'a foreign-source trip does not satisfy existence',
      routes
        .where('route_id', '=', 'ghost')
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('trips')
              .whereRef('trips.source_id', '=', 'routes.source_id')
              .whereRef('trips.route_id', '=', 'routes.route_id')
              .select('trip_id'),
          ),
        ),
      [],
    ],
    [
      'weekday shapes',
      db
        .selectFrom('shapes')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('trips')
              .whereRef('trips.source_id', '=', 'shapes.source_id')
              .whereRef('trips.shape_id', '=', 'shapes.shape_id')
              .where('service_id', '=', 'weekday')
              .select('trip_id'),
          ),
        )
        .select('shape_id'),
      [{ shape_id: 'red-shape' }],
    ],
    [
      'stop times without a red trip',
      db
        .selectFrom('stop_times')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('trips')
                .whereRef('trips.source_id', '=', 'stop_times.source_id')
                .whereRef('trips.trip_id', '=', 'stop_times.trip_id')
                .where('route_id', '=', 'red')
                .select('trip_id'),
            ),
          ),
        )
        .select('trip_id'),
      [{ trip_id: 'blue-trip' }],
    ],
    [
      'inclusive arrival bounds with route and service date',
      db
        .selectFrom('stop_times as time')
        .innerJoin('trips as trip', (join) =>
          join
            .onRef('trip.source_id', '=', 'time.source_id')
            .onRef('trip.trip_id', '=', 'time.trip_id'),
        )
        .innerJoin(activeTripKeys(db, 20260826).as('active'), (join) =>
          join
            .onRef('active.source_id', '=', 'time.source_id')
            .onRef('active.trip_id', '=', 'time.trip_id'),
        )
        .where('time.source_id', '=', sourceId)
        .where('trip.route_id', '=', 'red')
        .where('time.arrival_service_day_seconds', '>=', 32340)
        .where('time.arrival_service_day_seconds', '<=', 32520)
        .select('time.trip_id')
        .orderBy('time.trip_id'),
      [{ trip_id: 'red-trip' }, { trip_id: 'red-trip-2' }],
    ],
    [
      'alerts selecting a route',
      db
        .selectFrom('alerts')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('alert_entity_selectors as selector')
              .whereRef('selector.source_id', '=', 'alerts.source_id')
              .whereRef(
                'selector.realtime_feed_id',
                '=',
                'alerts.realtime_feed_id',
              )
              .whereRef('selector.alert_id', '=', 'alerts.entity_id')
              .where('selector.route_id', '=', 'red')
              .select('selector.alert_id'),
          ),
        )
        .select(['entity_id', 'header_text']),
      [{ entity_id: 'red-alert', header_text: 'Red alert' }],
    ],
    [
      'route and stop must match the same selector',
      db
        .selectFrom('alerts')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('alert_entity_selectors as selector')
              .whereRef('selector.source_id', '=', 'alerts.source_id')
              .whereRef(
                'selector.realtime_feed_id',
                '=',
                'alerts.realtime_feed_id',
              )
              .whereRef('selector.alert_id', '=', 'alerts.entity_id')
              .where('selector.route_id', '=', 'red')
              .where('selector.stop_id', '=', 'red-stop')
              .select('selector.alert_id'),
          ),
        )
        .select('entity_id'),
      [],
    ],
  ] as const;
}

export function flexRelationshipCases(
  db: Kysely<GtfsDatabase>,
  sourceId: string,
) {
  return [
    [
      'agency through route and network junction',
      db
        .selectFrom('agency')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('routes as route')
              .innerJoin('route_networks as junction', (join) =>
                join
                  .onRef('junction.source_id', '=', 'route.source_id')
                  .onRef('junction.route_id', '=', 'route.route_id'),
              )
              .innerJoin('networks as network', (join) =>
                join
                  .onRef('network.source_id', '=', 'junction.source_id')
                  .onRef('network.network_id', '=', 'junction.network_id'),
              )
              .whereRef('route.source_id', '=', 'agency.source_id')
              .whereRef('route.agency_id', '=', 'agency.agency_id')
              .where('network.network_name', '=', 'Rail')
              .select('route.route_id'),
          ),
        )
        .select('agency_id'),
      [{ agency_id: 'metro' }],
    ],
    [
      'network through route and agency',
      db
        .selectFrom('networks')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('route_networks as junction')
              .innerJoin('routes as route', (join) =>
                join
                  .onRef('route.source_id', '=', 'junction.source_id')
                  .onRef('route.route_id', '=', 'junction.route_id'),
              )
              .innerJoin('agency', (join) =>
                join
                  .onRef('agency.source_id', '=', 'route.source_id')
                  .onRef('agency.agency_id', '=', 'route.agency_id'),
              )
              .whereRef('junction.source_id', '=', 'networks.source_id')
              .whereRef('junction.network_id', '=', 'networks.network_id')
              .where('agency.agency_id', '=', 'metro')
              .select('junction.route_id'),
          ),
        )
        .select('network_id'),
      [{ network_id: 'rail' }],
    ],
    [
      'level through parent, area and location-group junctions',
      db
        .selectFrom('levels')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('stops as stop')
              .innerJoin('stops as parent', (join) =>
                join
                  .onRef('parent.source_id', '=', 'stop.source_id')
                  .onRef('parent.stop_id', '=', 'stop.parent_station'),
              )
              .innerJoin('stop_areas as membership', (join) =>
                join
                  .onRef('membership.source_id', '=', 'stop.source_id')
                  .onRef('membership.stop_id', '=', 'stop.stop_id'),
              )
              .innerJoin('areas as area', (join) =>
                join
                  .onRef('area.source_id', '=', 'membership.source_id')
                  .onRef('area.area_id', '=', 'membership.area_id'),
              )
              .innerJoin('location_group_stops as group_stop', (join) =>
                join
                  .onRef('group_stop.source_id', '=', 'stop.source_id')
                  .onRef('group_stop.stop_id', '=', 'stop.stop_id'),
              )
              .innerJoin('location_groups as group', (join) =>
                join
                  .onRef('group.source_id', '=', 'group_stop.source_id')
                  .onRef(
                    'group.location_group_id',
                    '=',
                    'group_stop.location_group_id',
                  ),
              )
              .whereRef('stop.source_id', '=', 'levels.source_id')
              .whereRef('stop.level_id', '=', 'levels.level_id')
              .where('parent.stop_id', '=', 'station')
              .where('area.area_id', '=', 'paid-area')
              .where('group.location_group_id', '=', 'flex-group')
              .select('stop.stop_id'),
          ),
        )
        .select('level_id'),
      [{ level_id: 'mezzanine' }],
    ],
    [
      'every child has the requested level',
      db
        .selectFrom('stops')
        .where('source_id', '=', sourceId)
        .where('stop_id', '=', 'station')
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom('stops as child')
                .whereRef('child.source_id', '=', 'stops.source_id')
                .whereRef('child.parent_station', '=', 'stops.stop_id')
                .where((child) =>
                  child.not(
                    child.exists(
                      child
                        .selectFrom('levels')
                        .whereRef('levels.source_id', '=', 'child.source_id')
                        .whereRef('levels.level_id', '=', 'child.level_id')
                        .where('levels.level_id', '=', 'mezzanine')
                        .select('levels.level_id'),
                    ),
                  ),
                )
                .select('child.stop_id'),
            ),
          ),
        )
        .select('stop_id'),
      [{ stop_id: 'station' }],
    ],
    [
      'trips with a frequency',
      db
        .selectFrom('trips')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('frequencies')
              .whereRef('frequencies.source_id', '=', 'trips.source_id')
              .whereRef('frequencies.trip_id', '=', 'trips.trip_id')
              .where('headway_secs', '=', 600)
              .select('trip_id'),
          ),
        )
        .select('trip_id'),
      [{ trip_id: 'red-trip' }],
    ],
    [
      'frequency with a route trip',
      db
        .selectFrom('frequencies')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('trips')
              .whereRef('trips.source_id', '=', 'frequencies.source_id')
              .whereRef('trips.trip_id', '=', 'frequencies.trip_id')
              .where('route_id', '=', 'red')
              .select('trip_id'),
          ),
        )
        .select('trip_id'),
      [{ trip_id: 'red-trip' }],
    ],
    [
      'Flex location and both booking rules',
      db
        .selectFrom('stop_times as time')
        .innerJoin('locations as location', (join) =>
          join
            .onRef('location.source_id', '=', 'time.source_id')
            .onRef('location.id', '=', 'time.location_id'),
        )
        .innerJoin('location_groups as group', (join) =>
          join
            .onRef('group.source_id', '=', 'time.source_id')
            .onRef('group.location_group_id', '=', 'time.location_group_id'),
        )
        .innerJoin('booking_rules as pickup', (join) =>
          join
            .onRef('pickup.source_id', '=', 'time.source_id')
            .onRef(
              'pickup.booking_rule_id',
              '=',
              'time.pickup_booking_rule_id',
            ),
        )
        .innerJoin('booking_rules as dropoff', (join) =>
          join
            .onRef('dropoff.source_id', '=', 'time.source_id')
            .onRef(
              'dropoff.booking_rule_id',
              '=',
              'time.drop_off_booking_rule_id',
            ),
        )
        .where('time.source_id', '=', sourceId)
        .where('location.id', '=', 'zone-1')
        .where('group.location_group_id', '=', 'flex-group')
        .where('pickup.booking_rule_id', '=', 'pickup-rule')
        .where('dropoff.booking_rule_id', '=', 'drop-rule')
        .select('time.trip_id'),
      [{ trip_id: 'red-trip' }],
    ],
    [
      'both pathway endpoints',
      db
        .selectFrom('pathways')
        .innerJoin('stops as from_stop', (join) =>
          join
            .onRef('from_stop.source_id', '=', 'pathways.source_id')
            .onRef('from_stop.stop_id', '=', 'pathways.from_stop_id'),
        )
        .innerJoin('stops as to_stop', (join) =>
          join
            .onRef('to_stop.source_id', '=', 'pathways.source_id')
            .onRef('to_stop.stop_id', '=', 'pathways.to_stop_id'),
        )
        .where('pathways.source_id', '=', sourceId)
        .where('from_stop.stop_id', '=', 'platform-1')
        .where('to_stop.stop_id', '=', 'platform-2')
        .select('pathway_id'),
      [{ pathway_id: 'walkway' }],
    ],
    [
      'area through stop membership',
      db
        .selectFrom('areas')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('stop_areas as membership')
              .innerJoin('stops as stop', (join) =>
                join
                  .onRef('stop.source_id', '=', 'membership.source_id')
                  .onRef('stop.stop_id', '=', 'membership.stop_id'),
              )
              .whereRef('membership.source_id', '=', 'areas.source_id')
              .whereRef('membership.area_id', '=', 'areas.area_id')
              .where('stop.stop_id', '=', 'platform-1')
              .select('stop.stop_id'),
          ),
        )
        .select('area_id'),
      [{ area_id: 'paid-area' }],
    ],
    [
      'location group through stop membership',
      db
        .selectFrom('location_groups')
        .where('source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('location_group_stops as membership')
              .innerJoin('stops as stop', (join) =>
                join
                  .onRef('stop.source_id', '=', 'membership.source_id')
                  .onRef('stop.stop_id', '=', 'membership.stop_id'),
              )
              .whereRef(
                'membership.source_id',
                '=',
                'location_groups.source_id',
              )
              .whereRef(
                'membership.location_group_id',
                '=',
                'location_groups.location_group_id',
              )
              .where('stop.stop_id', '=', 'platform-1')
              .select('stop.stop_id'),
          ),
        )
        .select('location_group_id'),
      [{ location_group_id: 'flex-group' }],
    ],
  ] as const;
}

export function realtimeRelationshipCases(
  db: Kysely<GtfsDatabase>,
  sourceId: string,
) {
  const snapshots = db
    .selectFrom('realtime_snapshots as snapshot')
    .where('snapshot.source_id', '=', sourceId)
    .select(['snapshot.snapshot_id', 'snapshot.realtime_feed_id']);
  return [
    [
      'feeds through snapshots and entities',
      db
        .selectFrom('realtime_feeds as feed')
        .where('feed.source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('realtime_snapshots as snapshot')
              .innerJoin('realtime_feed_entities as entity', (join) =>
                join
                  .onRef('entity.source_id', '=', 'snapshot.source_id')
                  .onRef(
                    'entity.realtime_feed_id',
                    '=',
                    'snapshot.realtime_feed_id',
                  )
                  .onRef('entity.snapshot_id', '=', 'snapshot.snapshot_id'),
              )
              .whereRef('snapshot.source_id', '=', 'feed.source_id')
              .whereRef(
                'snapshot.realtime_feed_id',
                '=',
                'feed.realtime_feed_id',
              )
              .where('entity.entity_id', '=', 'entity-1')
              .select('snapshot.snapshot_id'),
          ),
        )
        .select('feed.realtime_feed_id'),
      [{ realtime_feed_id: 'live' }],
    ],
    [
      'snapshots with some updates, no alerts and no deleted entities',
      snapshots
        .where((eb) => {
          const entities = eb
            .selectFrom('realtime_feed_entities as entity')
            .whereRef('entity.source_id', '=', 'snapshot.source_id')
            .whereRef(
              'entity.realtime_feed_id',
              '=',
              'snapshot.realtime_feed_id',
            )
            .whereRef('entity.snapshot_id', '=', 'snapshot.snapshot_id')
            .select('entity.entity_id');
          return eb.and([
            eb.exists(entities.where('entity.entity_type', '=', 'trip_update')),
            eb.not(
              eb.exists(entities.where('entity.entity_type', '=', 'alert')),
            ),
            eb.not(eb.exists(entities.where('entity.is_deleted', '!=', 0))),
          ]);
        })
        .orderBy('snapshot.snapshot_id'),
      [{ snapshot_id: 'snapshot-1', realtime_feed_id: 'live' }],
    ],
    [
      'snapshots containing an entity',
      snapshots.where((eb) =>
        eb.exists(
          eb
            .selectFrom('realtime_feed_entities as entity')
            .whereRef('entity.source_id', '=', 'snapshot.source_id')
            .whereRef(
              'entity.realtime_feed_id',
              '=',
              'snapshot.realtime_feed_id',
            )
            .whereRef('entity.snapshot_id', '=', 'snapshot.snapshot_id')
            .where('entity.entity_id', '=', 'entity-1')
            .select('entity.entity_id'),
        ),
      ),
      [{ snapshot_id: 'snapshot-1', realtime_feed_id: 'live' }],
    ],
    [
      'entities through snapshot and feed',
      db
        .selectFrom('realtime_feed_entities as entity')
        .innerJoin('realtime_snapshots as snapshot', (join) =>
          join
            .onRef('snapshot.source_id', '=', 'entity.source_id')
            .onRef('snapshot.realtime_feed_id', '=', 'entity.realtime_feed_id')
            .onRef('snapshot.snapshot_id', '=', 'entity.snapshot_id'),
        )
        .innerJoin('realtime_feeds as feed', (join) =>
          join
            .onRef('feed.source_id', '=', 'snapshot.source_id')
            .onRef('feed.realtime_feed_id', '=', 'snapshot.realtime_feed_id'),
        )
        .where('entity.source_id', '=', sourceId)
        .where('feed.feed_type', '=', 'mixed')
        .where('snapshot.payload_sha256', '=', 'north-hash')
        .select(['entity.entity_id', 'entity.realtime_feed_id']),
      [{ entity_id: 'entity-1', realtime_feed_id: 'live' }],
    ],
    [
      'updates through scheduled trips, routes and child stops',
      db
        .selectFrom('trip_updates as update')
        .innerJoin('trips as trip', (join) =>
          join
            .onRef('trip.source_id', '=', 'update.source_id')
            .onRef('trip.trip_id', '=', 'update.trip_id'),
        )
        .innerJoin('routes as route', (join) =>
          join
            .onRef('route.source_id', '=', 'trip.source_id')
            .onRef('route.route_id', '=', 'trip.route_id'),
        )
        .where('update.source_id', '=', sourceId)
        .where('route.agency_id', '=', 'metro')
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('trip_update_stop_time_updates as time')
              .innerJoin('stops as stop', (join) =>
                join
                  .onRef('stop.source_id', '=', 'time.source_id')
                  .onRef('stop.stop_id', '=', 'time.stop_id'),
              )
              .whereRef('time.source_id', '=', 'update.source_id')
              .whereRef('time.realtime_feed_id', '=', 'update.realtime_feed_id')
              .whereRef('time.trip_update_id', '=', 'update.entity_id')
              .where('stop.stop_id', '=', 'platform-1')
              .select('time.trip_update_id'),
          ),
        )
        .select(['update.entity_id', 'update.realtime_feed_id']),
      [{ entity_id: 'update-1', realtime_feed_id: 'live' }],
    ],
    [
      'child stop times through parent update, route and stop',
      db
        .selectFrom('trip_update_stop_time_updates as time')
        .innerJoin('trip_updates as update', (join) =>
          join
            .onRef('update.source_id', '=', 'time.source_id')
            .onRef('update.realtime_feed_id', '=', 'time.realtime_feed_id')
            .onRef('update.entity_id', '=', 'time.trip_update_id'),
        )
        .innerJoin('routes as route', (join) =>
          join
            .onRef('route.source_id', '=', 'time.source_id')
            .onRef('route.route_id', '=', 'time.route_id'),
        )
        .innerJoin('stops as stop', (join) =>
          join
            .onRef('stop.source_id', '=', 'time.source_id')
            .onRef('stop.stop_id', '=', 'time.stop_id'),
        )
        .where('time.source_id', '=', sourceId)
        .where('update.entity_id', '=', 'update-1')
        .where('route.route_id', '=', 'red')
        .where('stop.stop_id', '=', 'platform-1')
        .select(['time.trip_update_id', 'time.realtime_feed_id']),
      [{ trip_update_id: 'update-1', realtime_feed_id: 'live' }],
    ],
    [
      'vehicles through scheduled trip, route and stop',
      db
        .selectFrom('vehicle_positions as vehicle')
        .innerJoin('trips as trip', (join) =>
          join
            .onRef('trip.source_id', '=', 'vehicle.source_id')
            .onRef('trip.trip_id', '=', 'vehicle.trip_id'),
        )
        .innerJoin('routes as route', (join) =>
          join
            .onRef('route.source_id', '=', 'vehicle.source_id')
            .onRef('route.route_id', '=', 'vehicle.route_id'),
        )
        .innerJoin('stops as stop', (join) =>
          join
            .onRef('stop.source_id', '=', 'vehicle.source_id')
            .onRef('stop.stop_id', '=', 'vehicle.stop_id'),
        )
        .where('vehicle.source_id', '=', sourceId)
        .where('trip.trip_id', '=', 'scheduled-trip')
        .where('route.route_id', '=', 'red')
        .where('stop.stop_id', '=', 'platform-1')
        .select(['vehicle.entity_id', 'vehicle.realtime_feed_id']),
      [{ entity_id: 'vehicle-1', realtime_feed_id: 'live' }],
    ],
    [
      'alerts through ranges and scheduled selector targets',
      db
        .selectFrom('alerts as alert')
        .where('alert.source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('alert_time_ranges as range')
              .whereRef('range.source_id', '=', 'alert.source_id')
              .whereRef('range.realtime_feed_id', '=', 'alert.realtime_feed_id')
              .whereRef('range.alert_id', '=', 'alert.entity_id')
              .where('range.range_kind', '=', 'impact')
              .select('range.alert_id'),
          ),
        )
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('alert_entity_selectors as selector')
              .innerJoin('agency', (join) =>
                join
                  .onRef('agency.source_id', '=', 'selector.source_id')
                  .onRef('agency.agency_id', '=', 'selector.agency_id'),
              )
              .innerJoin('routes as route', (join) =>
                join
                  .onRef('route.source_id', '=', 'selector.source_id')
                  .onRef('route.route_id', '=', 'selector.route_id'),
              )
              .innerJoin('stops as stop', (join) =>
                join
                  .onRef('stop.source_id', '=', 'selector.source_id')
                  .onRef('stop.stop_id', '=', 'selector.stop_id'),
              )
              .innerJoin('trips as trip', (join) =>
                join
                  .onRef('trip.source_id', '=', 'selector.source_id')
                  .onRef('trip.trip_id', '=', 'selector.trip_id'),
              )
              .whereRef('selector.source_id', '=', 'alert.source_id')
              .whereRef(
                'selector.realtime_feed_id',
                '=',
                'alert.realtime_feed_id',
              )
              .whereRef('selector.alert_id', '=', 'alert.entity_id')
              .where('agency.agency_id', '=', 'metro')
              .where('route.route_id', '=', 'red')
              .where('stop.stop_id', '=', 'platform-1')
              .where('trip.trip_id', '=', 'scheduled-trip')
              .select('selector.alert_id'),
          ),
        )
        .select(['alert.entity_id', 'alert.realtime_feed_id']),
      [{ entity_id: 'alert-1', realtime_feed_id: 'live' }],
    ],
    [
      'ranges through parent alert and selector',
      db
        .selectFrom('alert_time_ranges as range')
        .innerJoin('alerts as alert', (join) =>
          join
            .onRef('alert.source_id', '=', 'range.source_id')
            .onRef('alert.realtime_feed_id', '=', 'range.realtime_feed_id')
            .onRef('alert.entity_id', '=', 'range.alert_id'),
        )
        .where('range.source_id', '=', sourceId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('alert_entity_selectors as selector')
              .whereRef('selector.source_id', '=', 'alert.source_id')
              .whereRef(
                'selector.realtime_feed_id',
                '=',
                'alert.realtime_feed_id',
              )
              .whereRef('selector.alert_id', '=', 'alert.entity_id')
              .where('selector.route_id', '=', 'red')
              .select('selector.alert_id'),
          ),
        )
        .select(['range.alert_id', 'range.realtime_feed_id']),
      [{ alert_id: 'alert-1', realtime_feed_id: 'live' }],
    ],
  ] as const;
}
