import { defineGtfsDomainTable } from '../../domain-table.ts';

export const stopVisits = defineGtfsDomainTable({
  filename: 'stop_visits.csv',
  tableName: 'stop_visits',
  presence: 'optional',
  primaryKey: ['service_date', 'trip_id_performed', 'trip_stop_sequence'],
  fields: {
    service_date: { kind: 'date', presence: 'required' },
    trip_id_performed: {
      kind: 'text',
      presence: 'required',
      references: [
        {
          targetFilename: 'trips_performed.csv',
          targetField: 'trip_id_performed',
        },
      ],
    },
    trip_stop_sequence: { kind: 'integer', presence: 'required', minimum: 1 },
    scheduled_stop_sequence: { kind: 'integer', minimum: 0 },
    pattern_id: { kind: 'id' },
    vehicle_id: {
      kind: 'id',
      references: [
        { targetFilename: 'vehicles.csv', targetField: 'vehicle_id' },
      ],
    },
    dwell: { kind: 'integer', minimum: 0 },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    timepoint: { kind: 'text' },
    schedule_arrival_time: { kind: 'text' },
    schedule_departure_time: { kind: 'text' },
    actual_arrival_time: { kind: 'text' },
    actual_departure_time: { kind: 'text' },
    distance: { kind: 'integer', minimum: 0 },
    boarding_1: { kind: 'integer', minimum: 0 },
    alighting_1: { kind: 'integer', minimum: 0 },
    boarding_2: { kind: 'integer', minimum: 0 },
    alighting_2: { kind: 'integer', minimum: 0 },
    departure_load: { kind: 'integer', minimum: 0 },
    door_open: { kind: 'text' },
    door_close: { kind: 'text' },
    door_status: { kind: 'text' },
    ramp_deployed_time: { kind: 'real', minimum: 0 },
    ramp_failure: { kind: 'text' },
    kneel_deployed_time: { kind: 'real', minimum: 0 },
    lift_deployed_time: { kind: 'real', minimum: 0 },
    bike_rack_deployed: { kind: 'text' },
    bike_load: { kind: 'integer', minimum: 0 },
    revenue: { kind: 'real' },
    number_of_transactions: { kind: 'integer', minimum: 0 },
    schedule_relationship: { kind: 'text' },
  },
  specification: 'tides',
});
