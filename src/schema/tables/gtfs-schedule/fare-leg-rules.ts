import { defineGtfsTable } from '../../define-table.ts';

export const fareLegRules = defineGtfsTable({
  file: 'fare_leg_rules.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'network_id',
    'from_area_id',
    'to_area_id',
    'from_timeframe_group_id',
    'to_timeframe_group_id',
    'fare_product_id',
  ],
  fields: {
    leg_group_id: { kind: 'id', applyFeedPrefix: true },
    network_id: {
      kind: 'id',
      references: [
        { file: 'routes.txt', field: 'network_id' },
        { file: 'networks.txt', field: 'network_id' },
      ],
      applyFeedPrefix: true,
    },
    from_area_id: {
      kind: 'id',
      references: [{ file: 'areas.txt', field: 'area_id' }],
      applyFeedPrefix: true,
    },
    to_area_id: {
      kind: 'id',
      references: [{ file: 'areas.txt', field: 'area_id' }],
      applyFeedPrefix: true,
    },
    from_timeframe_group_id: {
      kind: 'id',
      references: [{ file: 'timeframes.txt', field: 'timeframe_group_id' }],
      applyFeedPrefix: true,
    },
    to_timeframe_group_id: {
      kind: 'id',
      references: [{ file: 'timeframes.txt', field: 'timeframe_group_id' }],
      applyFeedPrefix: true,
    },
    fare_product_id: {
      kind: 'id',
      references: [{ file: 'fare_products.txt', field: 'fare_product_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    rule_priority: { kind: 'integer', minimum: 0 },
  },
});
