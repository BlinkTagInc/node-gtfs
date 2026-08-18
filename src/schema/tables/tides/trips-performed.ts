import { defineGtfsTable } from '../../define-table.ts';

export const tripsPerformed = defineGtfsTable({
  file: 'trips_performed.csv',
  presence: 'optional',
  primaryKey: ['service_date', 'trip_id_performed'],
  fields: {
    service_date: { kind: 'date', presence: 'required' },
    trip_id_performed: {
      kind: 'text',
      presence: 'required',
      applyFeedPrefix: true,
    },
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'vehicles.csv', field: 'vehicle_id' }],
      applyFeedPrefix: true,
    },
    trip_id_scheduled: {
      kind: 'text',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    route_type: { kind: 'text' },
    ntd_mode: { kind: 'text' },
    route_type_agency: { kind: 'text' },
    shape_id: {
      kind: 'id',
      references: [{ file: 'shapes.txt', field: 'shape_id' }],
      applyFeedPrefix: true,
    },
    pattern_id: { kind: 'id', applyFeedPrefix: true },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    operator_id: {
      kind: 'id',
      references: [{ file: 'operators.csv', field: 'operator_id' }],
      applyFeedPrefix: true,
    },
    block_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'block_id' }],
      applyFeedPrefix: true,
    },
    trip_start_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    trip_end_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    schedule_trip_start: { kind: 'text' },
    schedule_trip_end: { kind: 'text' },
    actual_trip_start: { kind: 'text' },
    actual_trip_end: { kind: 'text' },
    trip_type: { kind: 'text' },
    schedule_relationship: { kind: 'text' },
  },
  namespace: 'tides',
});
