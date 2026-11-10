import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareLegRules = defineGtfsDomainTable({
  filename: 'fare_leg_rules.txt',
  tableName: 'fare_leg_rules',
  specification: 'gtfs-schedule',
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
    leg_group_id: { kind: 'id' },
    network_id: {
      kind: 'id',
      references: [
        { targetFilename: 'routes.txt', targetField: 'network_id' },
        { targetFilename: 'networks.txt', targetField: 'network_id' },
      ],
    },
    from_area_id: {
      kind: 'id',
      references: [{ targetFilename: 'areas.txt', targetField: 'area_id' }],
    },
    to_area_id: {
      kind: 'id',
      references: [{ targetFilename: 'areas.txt', targetField: 'area_id' }],
    },
    from_timeframe_group_id: {
      kind: 'id',
      references: [
        { targetFilename: 'timeframes.txt', targetField: 'timeframe_group_id' },
      ],
    },
    to_timeframe_group_id: {
      kind: 'id',
      references: [
        { targetFilename: 'timeframes.txt', targetField: 'timeframe_group_id' },
      ],
    },
    fare_product_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_products.txt', targetField: 'fare_product_id' },
      ],
      presence: 'required',
    },
    rule_priority: { kind: 'integer', minimum: 0 },
  },
});
