import { defineGtfsTable } from '../../define-table.ts';

export const routeNetworks = defineGtfsTable({
  file: 'route_networks.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyForbidden',
  primaryKey: ['route_id'],
  fields: {
    network_id: {
      kind: 'id',
      references: [{ file: 'networks.txt', field: 'network_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
  },
  storage: {
    indexes: ['route_id'],
  },
});
