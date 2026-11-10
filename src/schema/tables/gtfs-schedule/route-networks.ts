import { defineGtfsDomainTable } from '../../domain-table.ts';

export const routeNetworks = defineGtfsDomainTable({
  filename: 'route_networks.txt',
  tableName: 'route_networks',
  specification: 'gtfs-schedule',
  presence: 'conditionally-forbidden',
  primaryKey: ['route_id'],
  fields: {
    network_id: {
      kind: 'id',
      references: [
        { targetFilename: 'networks.txt', targetField: 'network_id' },
      ],
      presence: 'required',
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
      presence: 'required',
    },
  },
});
