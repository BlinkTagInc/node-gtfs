import { defineGtfsDomainTable } from '../../domain-table.ts';

export const stops = defineGtfsDomainTable({
  filename: 'stops.txt',
  tableName: 'stops',
  specification: 'gtfs-schedule',
  presence: 'conditionally-required',
  primaryKey: ['stop_id'],
  fields: {
    stop_id: { kind: 'id', presence: 'required' },
    stop_code: { kind: 'text' },
    stop_name: {
      kind: 'text',
      presence: 'conditionally-required',
      supportsCaseInsensitiveComparison: true,
    },
    tts_stop_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
    stop_desc: { kind: 'text', supportsCaseInsensitiveComparison: true },
    stop_lat: {
      kind: 'real',
      presence: 'conditionally-required',
      minimum: -90,
      maximum: 90,
    },
    stop_lon: {
      kind: 'real',
      presence: 'conditionally-required',
      minimum: -180,
      maximum: 180,
    },
    zone_id: { kind: 'id' },
    stop_url: { kind: 'text' },
    location_type: { kind: 'integer', minimum: 0, maximum: 4 },
    parent_station: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    stop_timezone: { kind: 'text' },
    wheelchair_boarding: { kind: 'integer', minimum: 0, maximum: 2 },
    level_id: {
      kind: 'id',
      references: [{ targetFilename: 'levels.txt', targetField: 'level_id' }],
    },
    platform_code: { kind: 'text' },
    stop_access: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 1,
    },
  },
});
