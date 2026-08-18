import { defineGtfsTable } from '../../define-table.ts';

export const pathways = defineGtfsTable({
  file: 'pathways.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['pathway_id'],
  fields: {
    pathway_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    from_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    to_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    pathway_mode: {
      kind: 'integer',
      presence: 'required',
      minimum: 1,
      maximum: 7,
    },
    is_bidirectional: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
    },
    length: { kind: 'real', minimum: 0 },
    traversal_time: { kind: 'integer', minimum: 1 },
    stair_count: { kind: 'integer' },
    max_slope: { kind: 'real' },
    min_width: { kind: 'real', minimum: 0 },
    signposted_as: { kind: 'text', caseInsensitiveComparison: true },
    reversed_signposted_as: { kind: 'text', caseInsensitiveComparison: true },
  },
  storage: {
    indexes: ['from_stop_id', 'to_stop_id'],
  },
});
