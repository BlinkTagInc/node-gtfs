import { defineGtfsDomainTable } from '../../domain-table.ts';

export const riderCategories = defineGtfsDomainTable({
  filename: 'rider_categories.txt',
  tableName: 'rider_categories',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['rider_category_id'],
  fields: {
    rider_category_id: {
      kind: 'id',
      presence: 'required',
    },
    rider_category_name: {
      kind: 'text',
      presence: 'required',
      supportsCaseInsensitiveComparison: true,
    },
    is_default_fare_category: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
      defaultValue: 0,
    },
    eligibility_url: { kind: 'text' },
  },
});
