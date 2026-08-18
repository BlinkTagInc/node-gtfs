import { defineGtfsTable } from '../../define-table.ts';

export const routes = defineGtfsTable({
  file: 'routes.txt',
  namespace: 'gtfs-schedule',
  presence: 'required',
  primaryKey: ['route_id'],
  fields: {
    route_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    agency_id: {
      kind: 'id',
      presence: 'conditionallyRequired',
      references: [{ file: 'agency.txt', field: 'agency_id' }],
      applyFeedPrefix: true,
    },
    route_short_name: {
      kind: 'text',
      presence: 'conditionallyRequired',
      caseInsensitiveComparison: true,
    },
    route_long_name: {
      kind: 'text',
      presence: 'conditionallyRequired',
      caseInsensitiveComparison: true,
    },
    route_desc: { kind: 'text', caseInsensitiveComparison: true },
    route_type: { kind: 'integer', presence: 'required', minimum: 0 },
    route_url: { kind: 'text' },
    route_color: { kind: 'text', caseInsensitiveComparison: true },
    route_text_color: { kind: 'text', caseInsensitiveComparison: true },
    route_sort_order: { kind: 'integer', minimum: 0 },
    continuous_pickup: {
      kind: 'integer',
      presence: 'conditionallyForbidden',
      minimum: 0,
      maximum: 3,
    },
    continuous_drop_off: {
      kind: 'integer',
      presence: 'conditionallyForbidden',
      minimum: 0,
      maximum: 3,
    },
    network_id: {
      kind: 'id',
      presence: 'conditionallyForbidden',
      applyFeedPrefix: true,
    },
    cemv_support: { kind: 'integer', minimum: 0, maximum: 2 },
  },
  storage: {
    indexes: ['agency_id'],
  },
});
