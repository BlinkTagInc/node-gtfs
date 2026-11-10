import { defineGtfsDomainTable } from '../../domain-table.ts';

export const routes = defineGtfsDomainTable({
  filename: 'routes.txt',
  tableName: 'routes',
  specification: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['route_id'],
  fields: {
    route_id: { kind: 'id', presence: 'required' },
    agency_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: [{ targetFilename: 'agency.txt', targetField: 'agency_id' }],
    },
    route_short_name: {
      kind: 'text',
      presence: 'conditionally-required',
      supportsCaseInsensitiveComparison: true,
    },
    route_long_name: {
      kind: 'text',
      presence: 'conditionally-required',
      supportsCaseInsensitiveComparison: true,
    },
    route_desc: { kind: 'text', supportsCaseInsensitiveComparison: true },
    route_type: { kind: 'integer', presence: 'required', minimum: 0 },
    route_url: { kind: 'text' },
    route_color: { kind: 'text', supportsCaseInsensitiveComparison: true },
    route_text_color: { kind: 'text', supportsCaseInsensitiveComparison: true },
    route_sort_order: { kind: 'integer', minimum: 0 },
    continuous_pickup: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 3,
    },
    continuous_drop_off: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
      minimum: 0,
      maximum: 3,
    },
    network_id: {
      kind: 'id',
      presence: 'conditionally-forbidden',
    },
    cemv_support: { kind: 'integer', minimum: 0, maximum: 2 },
  },
});
