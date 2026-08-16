import { defineGtfsTable } from '../../define-table.ts';

export const levels = defineGtfsTable({
  file: 'levels.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyRequired',
  primaryKey: ['level_id'],
  fields: {
    level_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    level_index: { kind: 'real', presence: 'required' },
    level_name: { kind: 'text', caseInsensitiveComparison: true },
  },
});
