import { defineGtfsTable } from '../../define-table.ts';

export const attributions = defineGtfsTable({
  file: 'attributions.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['attribution_id'],
  fields: {
    attribution_id: { kind: 'id', applyFeedPrefix: true },
    agency_id: {
      kind: 'id',
      references: [{ file: 'agency.txt', field: 'agency_id' }],
      applyFeedPrefix: true,
    },
    route_id: {
      kind: 'id',
      references: [{ file: 'routes.txt', field: 'route_id' }],
      applyFeedPrefix: true,
    },
    trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    organization_name: {
      kind: 'text',
      presence: 'required',
      caseInsensitiveComparison: true,
    },
    is_producer: { kind: 'integer', minimum: 0, maximum: 1 },
    is_operator: { kind: 'integer', minimum: 0, maximum: 1 },
    is_authority: { kind: 'integer', minimum: 0, maximum: 1 },
    attribution_url: { kind: 'text' },
    attribution_email: { kind: 'text', caseInsensitiveComparison: true },
    attribution_phone: { kind: 'text', caseInsensitiveComparison: true },
  },
});
