import { defineGtfsDomainTable } from '../../domain-table.ts';

/** Current GTFS Realtime Shape entities, scoped by their stable feed source. */
export const realtimeShapes = defineGtfsDomainTable({
  filename: null,
  tableName: 'realtime_shapes',
  presence: 'optional',
  primaryKey: ['realtime_feed_id', 'entity_id'],
  fields: {
    realtime_feed_id: { kind: 'id', presence: 'required' },
    entity_id: { kind: 'id', presence: 'required', sourcePath: 'id' },
    shape_id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'shape.shapeId',
    },
    encoded_polyline: {
      kind: 'text',
      presence: 'required',
      sourcePath: 'shape.encodedPolyline',
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
