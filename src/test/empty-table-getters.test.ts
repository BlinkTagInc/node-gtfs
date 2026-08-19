import { describe, it, expect, withGtfsFixture } from './test-utils.ts';
import * as gtfs from '../../dist/index.js';

/*
 * The Caltrain fixture contains no rows for these tables, so each getter
 * should return an empty array. Collapsing them into one table-driven suite
 * keeps the signal these checks carry — that the getter is exported, its
 * table exists, and the filtered column is valid — while importing the
 * fixture once rather than once per getter.
 *
 * Getters with fixture data of their own have their own dedicated test file.
 */
const emptyTableGetters: Array<[getter: string, column: string]> = [
  ['getAreas', 'area_id'],
  ['getAttributions', 'attribution_id'],
  ['getBoardAlights', 'trip_id'],
  ['getBookingRules', 'booking_rule_id'],
  ['getCalendarAttributes', 'service_id'],
  ['getDeadheadTimes', 'deadhead_id'],
  ['getDeadheads', 'deadhead_id'],
  ['getDevices', 'device_id'],
  ['getDirections', 'route_id'],
  ['getFareLegRules', 'leg_group_id'],
  ['getFareMedia', 'fare_media_id'],
  ['getFareProducts', 'fare_product_id'],
  ['getFareTransactions', 'transaction_id'],
  ['getFareTransferRules', 'from_leg_group_id'],
  ['getFeedInfo', 'feed_publisher_name'],
  ['getFrequencies', 'trip_id'],
  ['getLevels', 'level_id'],
  ['getLocationGroupStops', 'location_group_id'],
  ['getLocationGroups', 'location_group_id'],
  ['getNetworks', 'network_id'],
  ['getOperators', 'operator_id'],
  ['getOpsLocations', 'ops_location_id'],
  ['getPassengerEvents', 'passenger_event_id'],
  ['getPathways', 'pathway_id'],
  ['getRideFeedInfo', 'ride_feed_version'],
  ['getRiderCategories', 'rider_category_id'],
  ['getRiderTrips', 'trip_id'],
  ['getRidership', 'route_id'],
  ['getRouteAttributes', 'route_id'],
  ['getRouteNetworks', 'network_id'],
  ['getRunEvents', 'run_event_id'],
  ['getRunsPieces', 'piece_id'],
  ['getServiceAlertInformedEntities', 'alert_id'],
  ['getStationActivities', 'stop_id'],
  ['getStopAreas', 'area_id'],
  ['getStopAttributes', 'stop_id'],
  ['getStopVisits', 'trip_id_performed'],
  ['getTimeframes', 'timeframe_group_id'],
  ['getTimetableNotesReferences', 'note_id'],
  ['getTimetableNotes', 'note_id'],
  ['getTimetablePages', 'timetable_page_id'],
  ['getTimetableStopOrders', 'timetable_id'],
  ['getTimetables', 'timetable_id'],
  ['getTrainCars', 'train_car_id'],
  ['getTransfers', 'from_stop_id'],
  ['getTranslations', 'field_name'],
  ['getTripCapacities', 'trip_id'],
  ['getTripsDatedVehicleJourneys', 'trip_id'],
  ['getTripsPerformed', 'trip_id_performed'],
  ['getVehicleLocations', 'location_ping_id'],
  ['getVehicleTrainCars', 'vehicle_id'],
  ['getVehicles', 'vehicle_id'],
];

describe('getters for tables with no fixture rows:', () => {
  withGtfsFixture();

  for (const [getterName, column] of emptyTableGetters) {
    describe(`${getterName}():`, () => {
      it('should be exported as a function', () => {
        expect(typeof (gtfs as never)[getterName]).toBe('function');
      });

      it('should return an empty array when filtering on a valid column', () => {
        const getter = (gtfs as never)[getterName] as (
          query: Record<string, unknown>,
        ) => unknown[];

        expect(getter({ [column]: 'fake-id' })).toHaveLength(0);
      });

      it('should throw when filtering on a column that does not exist', () => {
        const getter = (gtfs as never)[getterName] as (
          query: Record<string, unknown>,
        ) => unknown[];

        // Proves the empty result above comes from a real query against a
        // real table rather than from the filter being silently ignored.
        expect(() => getter({ not_a_real_column: 'x' })).toThrow(
          'no such column',
        );
      });
    });
  }
});
