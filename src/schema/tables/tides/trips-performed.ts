import { defineGtfsDomainTable } from '../../domain-table.ts';

export const tripsPerformed = defineGtfsDomainTable({
  filename: 'trips_performed.csv',
  tableName: 'trips_performed',
  presence: 'optional',
  primaryKey: ['service_date', 'trip_id_performed'],
  fields: {
    service_date: { kind: 'date', presence: 'required' },
    trip_id_performed: {
      kind: 'text',
      presence: 'required',
    },
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'vehicles.csv', targetField: 'vehicle_id' },
      ],
    },
    trip_id_scheduled: {
      kind: 'text',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
    },
    route_type: { kind: 'text' },
    ntd_mode: { kind: 'text' },
    route_type_agency: { kind: 'text' },
    shape_id: {
      kind: 'id',
      references: [{ targetFilename: 'shapes.txt', targetField: 'shape_id' }],
    },
    pattern_id: { kind: 'id' },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    operator_id: {
      kind: 'id',
      references: [
        { targetFilename: 'operators.csv', targetField: 'operator_id' },
      ],
    },
    block_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'block_id' }],
    },
    trip_start_stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    trip_end_stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    schedule_trip_start: { kind: 'text' },
    schedule_trip_end: { kind: 'text' },
    actual_trip_start: { kind: 'text' },
    actual_trip_end: { kind: 'text' },
    trip_type: { kind: 'text' },
    schedule_relationship: { kind: 'text' },
  },
  specification: 'tides',
});
