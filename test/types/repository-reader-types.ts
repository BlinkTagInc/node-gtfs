import { type Gtfs, type Routes, type StopTimes, type Calendar } from 'gtfs';

export async function assertQueryBuilderTypes(gtfs: Gtfs): Promise<void> {
  const countPromise: Promise<number> = gtfs.schedule.routes
    .select('route_id')
    .count();
  void countPromise;
  // @ts-expect-error Count accepts no filter or aggregate selector.
  gtfs.schedule.routes.count({ route_id: 'red' });
  // @ts-expect-error Ordering fields belong to the selected table.
  gtfs.schedule.routes.orderBy([{ field: 'trip_id' }]);
  // @ts-expect-error Ordering directions are asc or desc.
  gtfs.schedule.routes.orderBy([{ field: 'route_id', direction: 'up' }]);
  const routes: Routes[] = await gtfs.schedule.routes.all();
  const times: StopTimes[] = await gtfs.schedule.stopTimes.all();
  const calendar: Calendar | null = await gtfs.schedule.calendar.first();
  const result: Promise<Routes[]> = gtfs.schedule.routes.all();
  const requiredRoute: Routes = await gtfs.schedule.routes.firstOrThrow();
  const requiredSelectedRoute = await gtfs.schedule.routes
    .select('route_id')
    .firstOrThrow();
  const requiredRouteId: string = requiredSelectedRoute.route_id;
  // @ts-expect-error Throwing lookups retain the selected row shape.
  void requiredSelectedRoute.route_type;
  const streamed: AsyncIterableIterator<{ route_id: string }> =
    gtfs.schedule.routes.select('route_id').stream();
  // @ts-expect-error Array promises are not streams.
  const invalidStream: AsyncIterable<Routes> = gtfs.schedule.routes.all();
  // @ts-expect-error Streams are not array promises.
  const invalidPromise: Promise<Routes[]> = gtfs.schedule.routes.stream();
  // @ts-expect-error Stream takes no arguments.
  gtfs.schedule.routes.stream({});
  // @ts-expect-error Inline firstOrThrow filters reject callbacks.
  gtfs.schedule.routes.firstOrThrow(() => ({}));
  void [streamed, invalidStream, invalidPromise];
  await gtfs.schedule.stopTimes
    .where({ arrival_service_day_seconds: 90000 })
    .all();
  // @ts-expect-error Numeric equality does not accept text.
  gtfs.schedule.stopTimes.where({ arrival_service_day_seconds: '90000' });
  const selected = await gtfs.schedule.routes
    .select('route_id', 'route_short_name')
    .all();
  const id: string = selected[0]!.route_id;
  // @ts-expect-error Only selected fields appear in the row.
  void selected[0]!.route_type;
  // @ts-expect-error Physical storage columns are not public selection fields.
  gtfs.schedule.routes.select('_unknown_fields');
  // @ts-expect-error Selection requires at least one field.
  gtfs.schedule.routes.select();
  // @ts-expect-error all() does not accept options.
  gtfs.schedule.routes.all({});
  // @ts-expect-error Query builder state is immutable.
  gtfs.schedule.routes.tableName = 'routes';
  // @ts-expect-error Omit undefined filter values.
  gtfs.schedule.routes.where({ route_id: undefined });
  // @ts-expect-error Equality objects do not accept operator objects.
  gtfs.schedule.routes.where({ route_type: { gt: 2 } });
  // @ts-expect-error where() requires an equality object.
  gtfs.schedule.routes.where(() => ({}));
  // @ts-expect-error Inline first filters are equality objects too.
  gtfs.schedule.routes.first(() => ({}));
  // @ts-expect-error Named relationships are not equality fields.
  gtfs.schedule.routes.where({ trips: { some: {} } });
  // @ts-expect-error Boolean groups use advanced SQL.
  gtfs.schedule.routes.where({ OR: [{ route_id: 'red' }] });
  // @ts-expect-error Membership uses advanced SQL.
  gtfs.schedule.routes.where({ route_id: ['red'] });
  // @ts-expect-error Sorting requires a field-order array, not callbacks.
  gtfs.schedule.routes.orderBy(() => []);
  gtfs.schedule.routes.orderBy([{ field: 'route_id', direction: 'asc' }]);
  await gtfs.schedule.trips
    .where({ route_id: 'red', serviceDate: 20260912 })
    .all();
  await gtfs.schedule.stops
    .where({ withinBounds: { south: 0, west: 0, north: 1, east: 1 } })
    .all();
  await gtfs.realtime.alerts
    .where({ communicationActiveAt: 0n, impactActiveAt: 1 })
    .all();
  await gtfs.database.withKysely({
    callback: (database) =>
      database
        .selectFrom('stop_times')
        .where('source_id', '=', 'metro')
        .whereRef(
          'departure_service_day_seconds',
          '>',
          'arrival_service_day_seconds',
        )
        .select(['trip_id', 'departure_time'])
        .execute(),
  });
  await gtfs.geojson.stops({
    useParentStation: true,
    routeId: 'red',
  });
  // @ts-expect-error Parent-station replacement requires a boolean.
  gtfs.geojson.stops({ useParentStation: 'yes' });
  // @ts-expect-error Parent-station replacement is only a stop option.
  gtfs.geojson.shapes({ useParentStation: true });
  // @ts-expect-error Parent-station replacement is only a stop option.
  gtfs.geojson.routes({ useParentStation: true });
  // @ts-expect-error GeoJSON equality filters do not expose relationship operators.
  gtfs.geojson.stops({ where: { stopTimes: { some: {} } } });
  gtfs.geojson.stops({
    // @ts-expect-error GeoJSON semantic bounds require all four coordinates.
    where: { withinBounds: { south: 0, west: 0, north: 1 } },
  });
  void [routes, times, calendar, result, requiredRoute, requiredRouteId, id];
}
