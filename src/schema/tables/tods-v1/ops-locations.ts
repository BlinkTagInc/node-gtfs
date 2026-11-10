import { defineGtfsDomainTable } from '../../domain-table.ts';

export const opsLocations = defineGtfsDomainTable({
  filename: 'ops_locations.txt',
  tableName: 'ops_locations',
  presence: 'optional',
  primaryKey: ['ops_location_id'],
  fields: {
    ops_location_id: {
      kind: 'id',
      presence: 'required',
    },
    ops_location_code: { kind: 'text' },
    ops_location_name: {
      kind: 'text',
      presence: 'required',
      supportsCaseInsensitiveComparison: true,
    },
    ops_location_desc: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
    ops_location_lat: {
      kind: 'real',
      presence: 'required',
      minimum: -90,
      maximum: 90,
    },
    ops_location_lon: {
      kind: 'real',
      presence: 'required',
      minimum: -180,
      maximum: 180,
    },
  },
  specification: 'tods-v1',
});
