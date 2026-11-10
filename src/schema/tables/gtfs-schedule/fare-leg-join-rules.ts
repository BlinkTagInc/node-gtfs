import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareLegJoinRules = defineGtfsDomainTable({
  filename: 'fare_leg_join_rules.txt',
  tableName: 'fare_leg_join_rules',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'from_network_id',
    'to_network_id',
    'from_stop_id',
    'to_stop_id',
  ],
  fields: {
    from_network_id: {
      kind: 'id',
      references: [
        { targetFilename: 'routes.txt', targetField: 'network_id' },
        { targetFilename: 'networks.txt', targetField: 'network_id' },
      ],
      presence: 'required',
    },
    to_network_id: {
      kind: 'id',
      references: [
        { targetFilename: 'routes.txt', targetField: 'network_id' },
        { targetFilename: 'networks.txt', targetField: 'network_id' },
      ],
      presence: 'required',
    },
    from_stop_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    to_stop_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
  },
});
