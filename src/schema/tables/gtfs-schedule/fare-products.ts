import { defineGtfsTable } from '../../define-table.ts';

export const fareProducts = defineGtfsTable({
  file: 'fare_products.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['fare_product_id', 'rider_category_id', 'fare_media_id'],
  fields: {
    fare_product_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    rider_category_id: {
      kind: 'id',
      references: [
        { file: 'rider_categories.txt', field: 'rider_category_id' },
      ],
      applyFeedPrefix: true,
    },
    fare_product_name: { kind: 'text', caseInsensitiveComparison: true },
    fare_media_id: {
      kind: 'id',
      references: [{ file: 'fare_media.txt', field: 'fare_media_id' }],
      applyFeedPrefix: true,
    },
    amount: { kind: 'real', presence: 'required' },
    currency: { kind: 'text', presence: 'required' },
  },
});
