import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Query-oriented Alert time ranges in protobuf order. */
export const alertTimeRanges = defineGtfsDomainTable({
  filename: null,
  tableName: 'alert_time_ranges',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'alert_id', 'range_kind', 'range_ordinal'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    alert_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'parent.id',
    },
    range_kind: {
      kind: 'enumeration',
      values: ['communication', 'impact', 'active'],
      closed: true,
      presence: 'required',
    },
    range_ordinal: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    start_unix_seconds: { kind: 'integer', minimum: 0, sourcePath: 'start' },
    end_unix_seconds: { kind: 'integer', minimum: 0, sourcePath: 'end' },
    is_valid: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
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
