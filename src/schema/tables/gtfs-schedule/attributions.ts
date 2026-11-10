import { defineGtfsDomainTable } from '../../domain-table.ts';

export const attributions = defineGtfsDomainTable({
  filename: 'attributions.txt',
  tableName: 'attributions',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['attribution_id'],
  fields: {
    attribution_id: { kind: 'id' },
    agency_id: {
      kind: 'id',
      references: [{ targetFilename: 'agency.txt', targetField: 'agency_id' }],
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
    },
    trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    organization_name: {
      kind: 'text',
      presence: 'required',
      supportsCaseInsensitiveComparison: true,
    },
    is_producer: { kind: 'integer', minimum: 0, maximum: 1 },
    is_operator: { kind: 'integer', minimum: 0, maximum: 1 },
    is_authority: { kind: 'integer', minimum: 0, maximum: 1 },
    attribution_url: { kind: 'text' },
    attribution_email: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
    attribution_phone: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
  },
});
