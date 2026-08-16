import { defineGtfsTable } from '../../define-table.ts';

export const opsLocations = defineGtfsTable({
  file: 'ops_locations.txt',
  presence: 'optional',
  primaryKey: ['ops_location_id'],
  fields: {
    ops_location_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    ops_location_code: { kind: 'text' },
    ops_location_name: {
      kind: 'text',
      presence: 'required',
      caseInsensitiveComparison: true,
    },
    ops_location_desc: { kind: 'text', caseInsensitiveComparison: true },
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
  namespace: 'tods',
});
