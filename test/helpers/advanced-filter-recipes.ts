import { sql, type ExpressionBuilder, type Kysely } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/index.ts';

// Concrete application queries, not a replacement relationship DSL.
export function parentStops(eb: ExpressionBuilder<GtfsDatabase, 'stops'>) {
  return eb
    .selectFrom('stops as parent')
    .select('parent.stop_id')
    .whereRef('parent.source_id', '=', 'stops.source_id')
    .whereRef('parent.stop_id', '=', 'stops.parent_station');
}

export function childStops(eb: ExpressionBuilder<GtfsDatabase, 'stops'>) {
  return eb
    .selectFrom('stops as child')
    .select('child.stop_id')
    .whereRef('child.source_id', '=', 'stops.source_id')
    .whereRef('child.parent_station', '=', 'stops.stop_id');
}

export function alertsForStop(
  database: Kysely<GtfsDatabase>,
  sourceId: string,
  feedId: string,
  stopId: string,
) {
  return database
    .selectFrom('alerts')
    .select('entity_id')
    .where('source_id', '=', sourceId)
    .where('realtime_feed_id', '=', feedId)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom('alert_entity_selectors as selector')
          .select('selector.alert_id')
          .whereRef('selector.source_id', '=', 'alerts.source_id')
          .whereRef('selector.realtime_feed_id', '=', 'alerts.realtime_feed_id')
          .whereRef('selector.alert_id', '=', 'alerts.entity_id')
          .where('selector.stop_id', '=', stopId),
      ),
    );
}

export function departuresAfterArrival(
  database: Kysely<GtfsDatabase>,
  sourceId: string,
) {
  return database
    .selectFrom('stop_times')
    .select(['trip_id', 'arrival_time', 'departure_time'])
    .where('source_id', '=', sourceId)
    .whereRef(
      'departure_service_day_seconds',
      '>',
      'arrival_service_day_seconds',
    );
}

export function literalLike(value: string): string {
  return value.replace(/[!%_]/g, '!$&');
}

export function stopsContainingFoldedText(
  database: Kysely<GtfsDatabase>,
  sourceId: string,
  foldedText: string,
) {
  return database
    .selectFrom('stops')
    .select('stop_id')
    .where('source_id', '=', sourceId)
    .where(
      () =>
        sql<boolean>`${sql.ref('stops._node_gtfs_casefold_stop_name')} like ${`%${literalLike(foldedText)}%`} escape '!'`,
    );
}

export function stopsMatchingPattern(
  database: Kysely<GtfsDatabase>,
  dialect: import('../../src/kysely.ts').GtfsDatabaseDialect,
  sourceId: string,
  patterns: { readonly sqlite: string; readonly sql: string },
) {
  return database
    .selectFrom('stops')
    .select('stop_id')
    .where('source_id', '=', sourceId)
    .where((eb) =>
      dialect === 'sqlite'
        ? sql<boolean>`${eb.ref('stop_name')} glob ${patterns.sqlite}`
        : sql<boolean>`${eb.ref('stop_name')} like ${patterns.sql} escape '!'`,
    );
}

export function stopsContainingText(
  database: Kysely<GtfsDatabase>,
  dialect: import('../../src/kysely.ts').GtfsDatabaseDialect,
  sourceId: string,
  literal: string,
) {
  return stopsMatchingPattern(database, dialect, sourceId, {
    sqlite: `*${literal.replace(/[[*?]/g, (character) => `[${character}]`)}*`,
    sql: `%${literalLike(literal)}%`,
  });
}

// Applications validate dates before constructing their SQL. The weekday is a
// fixed field name selected from this list, never a user-supplied SQL identifier.
export function serviceDateWeekday(date: number) {
  const text = String(date);
  if (!Number.isInteger(date) || !/^\d{8}$/.test(text)) {
    throw new TypeError('Expected a YYYYMMDD date');
  }
  const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== iso
  ) {
    throw new TypeError('Expected a real calendar date');
  }
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  return days[parsed.getUTCDay()]!;
}

export function activeTripKeys(database: Kysely<GtfsDatabase>, date: number) {
  const weekday = serviceDateWeekday(date);
  const services = database
    .selectFrom('calendar')
    .select(['source_id', 'service_id'])
    .where('start_date', '<=', date)
    .where('end_date', '>=', date)
    .where(weekday, '=', 1)
    .union(
      database
        .selectFrom('calendar_dates')
        .select(['source_id', 'service_id'])
        .where('date', '=', date)
        .where('exception_type', '=', 1),
    );
  return database
    .selectFrom('trips as active_trip')
    .innerJoin(services.as('active_service'), (join) =>
      join
        .onRef('active_service.source_id', '=', 'active_trip.source_id')
        .onRef('active_service.service_id', '=', 'active_trip.service_id'),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('calendar_dates as removed')
            .select('removed.service_id')
            .whereRef('removed.source_id', '=', 'active_trip.source_id')
            .whereRef('removed.service_id', '=', 'active_trip.service_id')
            .where('removed.date', '=', date)
            .where('removed.exception_type', '=', 2),
        ),
      ),
    )
    .select(['active_trip.source_id', 'active_trip.trip_id']);
}

export function faresBelowMinorUnits(
  database: Kysely<GtfsDatabase>,
  sourceId: string,
  currency: string,
  maximum: string,
) {
  // A validated integer string avoids converting large exact values to Number.
  if (
    typeof maximum !== 'string' ||
    !/^-?\d+$/.test(maximum) ||
    BigInt(maximum) < -(2n ** 63n) ||
    BigInt(maximum) > 2n ** 63n - 1n
  ) {
    throw new TypeError('Expected signed 64-bit integer minor units');
  }
  return database
    .selectFrom('fare_attributes')
    .where('source_id', '=', sourceId)
    .where('currency_type', '=', currency)
    .where('price', '<=', maximum);
}
