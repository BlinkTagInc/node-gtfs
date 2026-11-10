import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareTransferRules = defineGtfsDomainTable({
  filename: 'fare_transfer_rules.txt',
  tableName: 'fare_transfer_rules',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'from_leg_group_id',
    'to_leg_group_id',
    'fare_product_id',
    'transfer_count',
    'duration_limit',
  ],
  fields: {
    from_leg_group_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_leg_rules.txt', targetField: 'leg_group_id' },
      ],
    },
    to_leg_group_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_leg_rules.txt', targetField: 'leg_group_id' },
      ],
    },
    transfer_count: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: -1,
    },
    duration_limit: { kind: 'integer', minimum: 1 },
    duration_limit_type: {
      kind: 'integer',
      presence: 'conditionally-required',
      minimum: 0,
      maximum: 3,
    },
    fare_transfer_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 2,
    },
    fare_product_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_products.txt', targetField: 'fare_product_id' },
      ],
    },
  },
});
