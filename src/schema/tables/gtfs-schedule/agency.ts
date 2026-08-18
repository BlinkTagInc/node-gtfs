import { defineGtfsTable } from '../../define-table.ts';

export const agency = defineGtfsTable({
  file: 'agency.txt',
  namespace: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['agency_id'],
  fields: {
    agency_id: {
      kind: 'id',
      presence: 'conditionallyRequired',
      applyFeedPrefix: true,
    },
    agency_name: {
      kind: 'text',
      presence: 'required',
      caseInsensitiveComparison: true,
    },
    agency_url: { kind: 'text', presence: 'required' },
    agency_timezone: { kind: 'text', presence: 'required' },
    agency_lang: { kind: 'text', caseInsensitiveComparison: true },
    agency_phone: { kind: 'text', caseInsensitiveComparison: true },
    agency_fare_url: { kind: 'text' },
    agency_email: { kind: 'text', caseInsensitiveComparison: true },
    cemv_support: { kind: 'integer', minimum: 0, maximum: 2 },
  },
});
