import { defineGtfsTable } from '../../define-table.ts';

export const stopAttributes = defineGtfsTable({
  file: 'stop_attributes.txt',
  presence: 'optional',
  primaryKey: ['stop_id'],
  fields: {
    stop_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    accessibility_id: { kind: 'integer', minimum: 0 },
    cardinal_direction: { kind: 'text' },
    relative_position: { kind: 'text' },
    stop_city: { kind: 'text', caseInsensitiveComparison: true },
  },
  namespace: 'gtfs-plus',
});
