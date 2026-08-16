import { defineGtfsTable } from '../../define-table.ts';

export const stops = defineGtfsTable({
  file: 'stops.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyRequired',
  primaryKey: ['stop_id'],
  fields: {
    stop_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    stop_code: { kind: 'text' },
    stop_name: { kind: 'text', caseInsensitiveComparison: true },
    tts_stop_name: { kind: 'text', caseInsensitiveComparison: true },
    stop_desc: { kind: 'text', caseInsensitiveComparison: true },
    stop_lat: { kind: 'real', minimum: -90, maximum: 90 },
    stop_lon: { kind: 'real', minimum: -180, maximum: 180 },
    zone_id: { kind: 'id', applyFeedPrefix: true },
    stop_url: { kind: 'text' },
    location_type: { kind: 'integer', minimum: 0, maximum: 4 },
    parent_station: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    stop_timezone: { kind: 'text' },
    wheelchair_boarding: { kind: 'integer', minimum: 0, maximum: 2 },
    level_id: {
      kind: 'id',
      references: [{ file: 'levels.txt', field: 'level_id' }],
      applyFeedPrefix: true,
    },
    platform_code: { kind: 'text' },
    stop_access: { kind: 'integer', minimum: 0, maximum: 1 },
  },
  storage: {
    indexes: ['stop_code', 'parent_station'],
  },
});
