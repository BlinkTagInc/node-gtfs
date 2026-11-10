import type { Kysely } from 'kysely';
import type { GtfsDatabase } from 'gtfs/schema';
import { representativeTrips } from '../helpers/advanced-summary-recipes.ts';

export async function checkAdvancedSummaryTypes(
  database: Kysely<GtfsDatabase>,
) {
  const representatives = representativeTrips(database, ['north']);
  const rows = await representatives.select(['source_id', 'trip_id']).execute();
  const source: string = rows[0]!.source_id;
  const trip: string = rows[0]!.trip_id;
  void [source, trip];
  // @ts-expect-error The subquery does not expose fields that were not selected.
  representatives.select('stop_id');
  // @ts-expect-error Projection is retained through the window-function subquery.
  void rows[0]!.direction_id;
  database
    .selectFrom('trips')
    // @ts-expect-error Concrete GTFS table types reject nonexistent fields.
    .select((eb) => eb.fn.count('misspelled_id').as('total'));
}
