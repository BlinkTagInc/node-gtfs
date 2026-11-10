import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareAttributes = defineGtfsDomainTable({
  filename: 'fare_attributes.txt',
  tableName: 'fare_attributes',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['fare_id'],
  fields: {
    fare_id: { kind: 'id', presence: 'required' },
    price: {
      kind: 'real',
      presence: 'required',
      minimum: 0,
      monetary: {
        currencyField: 'currency_type',
        publicRepresentation: 'decimal-string',
      },
    },
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
      presence: 'conditionally-required',
      references: [{ targetFilename: 'agency.txt', targetField: 'agency_id' }],
    },
    transfer_duration: { kind: 'integer', minimum: 0 },
  },
});
