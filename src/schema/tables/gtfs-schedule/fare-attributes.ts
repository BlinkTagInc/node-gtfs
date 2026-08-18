import { defineGtfsTable } from '../../define-table.ts';

export const fareAttributes = defineGtfsTable({
  file: 'fare_attributes.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['fare_id'],
  fields: {
    fare_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    price: { kind: 'real', presence: 'required', minimum: 0 },
    currency_type: { kind: 'text', presence: 'required' },
    payment_method: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 1,
    },
    transfers: { kind: 'integer', minimum: 0, maximum: 2 },
    agency_id: {
      kind: 'id',
      presence: 'conditionallyRequired',
      references: [{ file: 'agency.txt', field: 'agency_id' }],
      applyFeedPrefix: true,
    },
    transfer_duration: { kind: 'integer', minimum: 0 },
  },
});
