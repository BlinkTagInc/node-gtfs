import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Current GTFS Realtime Stop entities, scoped by their stable feed source. */
export const realtimeStops = defineGtfsDomainTable({
  filename: null,
  tableName: 'realtime_stops',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'entity_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    entity_id: { kind: 'id', presence: 'required', sourcePath: 'id' },
    stop_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'stop.stopId',
    },
    stop_code: {
      kind: 'text',
      sourcePath: 'stop.stopCode.translation[0].text',
    },
    stop_code_translations: {
      kind: 'json',
      sourcePath: 'stop.stopCode.translation',
    },
    stop_name: {
      kind: 'text',
      sourcePath: 'stop.stopName.translation[0].text',
    },
    stop_name_translations: {
      kind: 'json',
      sourcePath: 'stop.stopName.translation',
    },
    tts_stop_name: {
      kind: 'text',
      sourcePath: 'stop.ttsStopName.translation[0].text',
    },
    tts_stop_name_translations: {
      kind: 'json',
      sourcePath: 'stop.ttsStopName.translation',
    },
    stop_desc: {
      kind: 'text',
      sourcePath: 'stop.stopDesc.translation[0].text',
    },
    stop_desc_translations: {
      kind: 'json',
      sourcePath: 'stop.stopDesc.translation',
    },
    stop_lat: {
      kind: 'real',
      minimum: -90,
      maximum: 90,
      sourcePath: 'stop.stopLat',
    },
    stop_lon: {
      kind: 'real',
      minimum: -180,
      maximum: 180,
      sourcePath: 'stop.stopLon',
    },
    zone_id: { kind: 'id', sourcePath: 'stop.zoneId' },
    stop_url: {
      kind: 'text',
      sourcePath: 'stop.stopUrl.translation[0].text',
    },
    stop_url_translations: {
      kind: 'json',
      sourcePath: 'stop.stopUrl.translation',
    },
    parent_station: { kind: 'id', sourcePath: 'stop.parentStation' },
    stop_timezone: { kind: 'text', sourcePath: 'stop.stopTimezone' },
    wheelchair_boarding: {
      kind: 'enumeration',
      values: ['UNKNOWN', 'AVAILABLE', 'NOT_AVAILABLE'],
      sourcePath: 'stop.wheelchairBoarding',
    },
    level_id: { kind: 'id', sourcePath: 'stop.levelId' },
    platform_code: {
      kind: 'text',
      sourcePath: 'stop.platformCode.translation[0].text',
    },
    platform_code_translations: {
      kind: 'json',
      sourcePath: 'stop.platformCode.translation',
    },
    created_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    expires_at_unix_seconds: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
  },
  specification: 'gtfs-realtime',
});
