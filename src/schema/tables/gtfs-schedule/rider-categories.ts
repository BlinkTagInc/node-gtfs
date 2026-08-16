import { defineGtfsTable } from '../../define-table.ts';

export const riderCategories = defineGtfsTable({
  file: 'rider_categories.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['rider_category_id'],
  fields: {
    rider_category_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    rider_category_name: {
      kind: 'text',
      presence: 'required',
      caseInsensitiveComparison: true,
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
