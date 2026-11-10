import { defineGtfsDomainTable } from '../../domain-table.ts';

export const agency = defineGtfsDomainTable({
  filename: 'agency.txt',
  tableName: 'agency',
  specification: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['agency_id'],
  fields: {
    agency_id: {
      kind: 'id',
      presence: 'conditionally-required',
    },
    agency_name: {
      kind: 'text',
      presence: 'required',
      supportsCaseInsensitiveComparison: true,
    },
    agency_url: { kind: 'text', presence: 'required' },
    agency_timezone: { kind: 'text', presence: 'required' },
    agency_lang: { kind: 'text', supportsCaseInsensitiveComparison: true },
    agency_phone: { kind: 'text', supportsCaseInsensitiveComparison: true },
    agency_fare_url: { kind: 'text' },
    agency_email: { kind: 'text', supportsCaseInsensitiveComparison: true },
    cemv_support: { kind: 'integer', minimum: 0, maximum: 2 },
  },
});
