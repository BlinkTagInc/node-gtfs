import { defineGtfsDomainTable } from '../../domain-table.ts';

export const trips = defineGtfsDomainTable({
  filename: 'trips.txt',
  tableName: 'trips',
  specification: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['trip_id'],
  fields: {
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
      presence: 'required',
    },
    service_id: {
      kind: 'id',
      references: [
        { targetFilename: 'calendar.txt', targetField: 'service_id' },
        { targetFilename: 'calendar_dates.txt', targetField: 'service_id' },
      ],
      presence: 'required',
    },
    trip_id: { kind: 'id', presence: 'required' },
    trip_headsign: { kind: 'text', supportsCaseInsensitiveComparison: true },
    trip_short_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
    direction_id: { kind: 'integer', minimum: 0, maximum: 1 },
    block_id: { kind: 'id' },
    shape_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'shapes.txt', targetField: 'shape_id' }],
    },
    wheelchair_accessible: { kind: 'integer', minimum: 0, maximum: 2 },
    bikes_allowed: { kind: 'integer', minimum: 0, maximum: 2 },
    cars_allowed: { kind: 'integer', minimum: 0, maximum: 2 },
    safe_duration_factor: { kind: 'real' },
    safe_duration_offset: { kind: 'real' },
  },
});
