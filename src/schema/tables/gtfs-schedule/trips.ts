import { defineGtfsTable } from '../../define-table.ts';

export const trips = defineGtfsTable({
  file: 'trips.txt',
  namespace: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['trip_id'],
  fields: {
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    service_id: {
      kind: 'id',
      references: [
        { file: 'calendar.txt', field: 'service_id' },
        { file: 'calendar_dates.txt', field: 'service_id' },
      ],
      presence: 'required',
      applyFeedPrefix: true,
    },
    trip_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    trip_headsign: { kind: 'text', caseInsensitiveComparison: true },
    trip_short_name: { kind: 'text', caseInsensitiveComparison: true },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    block_id: { kind: 'id', applyFeedPrefix: true },
    shape_id: {
      kind: 'id',
      presence: 'conditionallyRequired',
      references: [{ file: 'shapes.txt', field: 'shape_id' }],
      applyFeedPrefix: true,
    },
    wheelchair_accessible: { kind: 'integer', minimum: 0, maximum: 2 },
    bikes_allowed: { kind: 'integer', minimum: 0, maximum: 2 },
    cars_allowed: { kind: 'integer', minimum: 0, maximum: 2 },
    safe_duration_factor: { kind: 'real' },
    safe_duration_offset: { kind: 'real' },
  },
  storage: {
    indexes: [
      'service_id',
      'block_id',
      'shape_id',
      ['route_id', 'service_id', 'trip_id'],
    ],
  },
});
