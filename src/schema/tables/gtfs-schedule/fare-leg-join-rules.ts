import { defineGtfsTable } from '../../define-table.ts';

export const fareLegJoinRules = defineGtfsTable({
  file: 'fare_leg_join_rules.txt',
  namespace: 'gtfs-schedule',
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
        { file: 'routes.txt', field: 'network_id' },
        { file: 'networks.txt', field: 'network_id' },
      ],
      presence: 'required',
      applyFeedPrefix: true,
    },
    to_network_id: {
      kind: 'id',
      references: [
        { file: 'routes.txt', field: 'network_id' },
        { file: 'networks.txt', field: 'network_id' },
      ],
      presence: 'required',
      applyFeedPrefix: true,
    },
    from_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    to_stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
  },
});
