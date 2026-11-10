import { defineGtfsDomainTable } from '../../domain-table.ts';

export const pathways = defineGtfsDomainTable({
  filename: 'pathways.txt',
  tableName: 'pathways',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['pathway_id'],
  fields: {
    pathway_id: { kind: 'id', presence: 'required' },
    from_stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
      presence: 'required',
    },
    to_stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
      presence: 'required',
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
    signposted_as: { kind: 'text', supportsCaseInsensitiveComparison: true },
    reversed_signposted_as: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
  },
});
