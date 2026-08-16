import { defineGtfsTable } from '../../define-table.ts';

export const networks = defineGtfsTable({
  file: 'networks.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyForbidden',
  primaryKey: ['network_id'],
  fields: {
    network_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    network_name: { kind: 'text', caseInsensitiveComparison: true },
  },
});
