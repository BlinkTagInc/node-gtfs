import { defineGtfsTable } from '../../define-table.ts';

export const tripsDatedVehicleJourney = defineGtfsTable({
  file: 'trips_dated_vehicle_journey.txt',
  presence: 'optional',
  fields: {
    trip_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    operating_day_date: { kind: 'text', presence: 'required' },
    dated_vehicle_journey_gid: { kind: 'text', presence: 'required' },
    journey_number: {
      kind: 'integer',
      minimum: 0,
      maximum: 65535,
    },
  },
  storage: {
    indexes: ['trip_id', 'operating_day_date', 'journey_number'],
  },
  namespace: 'noptis',
});
