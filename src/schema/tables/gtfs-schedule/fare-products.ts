import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareProducts = defineGtfsDomainTable({
  filename: 'fare_products.txt',
  tableName: 'fare_products',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['fare_product_id', 'rider_category_id', 'fare_media_id'],
  fields: {
    fare_product_id: {
      kind: 'id',
      presence: 'required',
    },
    rider_category_id: {
      kind: 'id',
      references: [
        {
          targetFilename: 'rider_categories.txt',
          targetField: 'rider_category_id',
        },
      ],
    },
    fare_product_name: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
    fare_media_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_media.txt', targetField: 'fare_media_id' },
      ],
    },
    amount: {
      kind: 'real',
      presence: 'required',
      monetary: {
        currencyField: 'currency',
        publicRepresentation: 'decimal-string',
      },
    },
    currency: { kind: 'text', presence: 'required' },
  },
});
