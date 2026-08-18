import { defineGtfsTable } from '../../define-table.ts';

export const fareTransferRules = defineGtfsTable({
  file: 'fare_transfer_rules.txt',
  namespace: 'gtfs-schedule',
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
      references: [{ file: 'fare_leg_rules.txt', field: 'leg_group_id' }],
      applyFeedPrefix: true,
    },
    to_leg_group_id: {
      kind: 'id',
      references: [{ file: 'fare_leg_rules.txt', field: 'leg_group_id' }],
      applyFeedPrefix: true,
    },
    transfer_count: {
      kind: 'integer',
      presence: 'conditionallyForbidden',
      minimum: -1,
    },
    duration_limit: { kind: 'integer', minimum: 1 },
    duration_limit_type: {
      kind: 'integer',
      presence: 'conditionallyRequired',
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
      references: [{ file: 'fare_products.txt', field: 'fare_product_id' }],
      applyFeedPrefix: true,
    },
  },
});
