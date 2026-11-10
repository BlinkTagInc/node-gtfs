import type { Gtfs } from 'gtfs';
import { foldGtfsText } from 'gtfs/kysely';
import { sql } from 'kysely';
declare const gtfs: Gtfs;
const folded: string = foldGtfsText('Straße');
void folded;
void gtfs.geojson.stops({
  routeId: 'red',
  serviceDate: 20260922,
  useParentStation: true,
  where: {
    source_id: 'north',
    withinBounds: { south: 0, north: 1, west: 0, east: 1 },
  },
  sqlWhere: (eb) =>
    eb.or([
      eb('stops.location_type', '=', 0),
      eb('stops.location_type', 'is', null),
    ]),
});
void gtfs.geojson.shapes({
  sqlWhere: (eb) => eb('shapes.shape_pt_sequence', '>=', 1),
});
void gtfs.geojson.routes({
  sqlWhere: (eb) =>
    eb.exists(
      eb
        .selectFrom('trips')
        .select('trip_id')
        .whereRef('trips.source_id', '=', 'routes.source_id')
        .whereRef('trips.route_id', '=', 'routes.route_id')
        .where('trips.direction_id', '=', 0),
    ),
});
void gtfs.geojson.stops({ sqlWhere: () => sql<boolean>`1 = 1` });
// @ts-expect-error equality filters require an object
void gtfs.geojson.stops({ where: () => true });
// @ts-expect-error SQL predicates return a Kysely expression, not a JS boolean
void gtfs.geojson.stops({ sqlWhere: () => true });
void gtfs.geojson.stops({
  // @ts-expect-error root-table fields are checked
  sqlWhere: (eb) => eb('routes.route_id', '=', 'red'),
});
void gtfs.geojson.stops({
  // @ts-expect-error SQL predicates cannot replace the root query
  sqlWhere: (eb) => eb.selectFrom('stops').selectAll(),
});
// @ts-expect-error predicates are synchronous expressions
void gtfs.geojson.stops({ sqlWhere: async (eb) => eb('stop_id', '=', 'a') });
// @ts-expect-error service dates are numbers
void gtfs.geojson.routes({ serviceDate: '20260922' });
