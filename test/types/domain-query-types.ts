import type { Gtfs, GtfsReader, Stops, Trips, StopTimes } from 'gtfs';

declare const gtfs: Gtfs;
const stops: GtfsReader<'stops', Stops> = gtfs.query.stopsForRoute({
  routeId: 'red',
  useParentStation: true,
});
const trips: GtfsReader<'trips', Trips> = gtfs.query.activeTrips({
  serviceDate: 20260922,
});
const times: GtfsReader<'stop_times', StopTimes> = gtfs.query.stopTimes({
  serviceDate: 20260922,
  stopId: 'platform',
  routeId: 'red',
  window: { field: 'departure_time', start: '25:00:00', end: '26:00:00' },
});
const projected: Promise<{ stop_id: string; source_id: string }[]> = stops
  .select('stop_id', 'source_id')
  .where({ source_id: 'north' })
  .orderBy([{ field: 'stop_name', direction: 'desc' }])
  .limit(10)
  .offset(5)
  .all();
const count: Promise<number> = times.count();
const first: Promise<Trips | null> = trips.first({ trip_id: 'daily' });
const rows: AsyncIterableIterator<Stops> = stops.stream();
const required: Promise<{ stop_id: string }> = stops
  .select('stop_id')
  .firstOrThrow({ stop_id: 'platform' });
void required;
void [projected, count, first, rows];
// @ts-expect-error domain readers take equality objects, not field proxies
stops.where((s) => s.stop_id.eq('platform'));
// @ts-expect-error arbitrary comparisons belong in withKysely
stops.where({ stop_id: { in: ['platform'] } });
// @ts-expect-error field names must belong to the reader table
stops.orderBy([{ field: 'trip_id' }]);
// @ts-expect-error ordering uses field objects
stops.orderBy(() => []);
// @ts-expect-error projection uses fields of the table
stops.select('trip_id');
// @ts-expect-error projection is reflected in the returned row type
const invalidProjection: Promise<Stops[]> = stops.select('stop_id').all();
// @ts-expect-error domain readers do not expose the aggregate DSL
stops.aggregate(() => ({}));
// @ts-expect-error domain readers do not expose relationship quantifiers
stops.where({ stopTimes: { some: {} } });
// @ts-expect-error serviceDate is required
void gtfs.query.stopTimes({ stopId: 'platform' });
void gtfs.query.stopTimes({
  serviceDate: 20260922,
  // @ts-expect-error windows require an explicit supported time field
  window: { field: 'stop_id', start: '25:00:00', end: '26:00:00' },
});
void invalidProjection;
