import { defineGtfsDomainTable } from '../../domain-table.ts';

export const levels = defineGtfsDomainTable({
  filename: 'levels.txt',
  tableName: 'levels',
  specification: 'gtfs-schedule',
  presence: 'conditionally-required',
  primaryKey: ['level_id'],
  fields: {
    level_id: { kind: 'id', presence: 'required' },
    level_index: { kind: 'real', presence: 'required' },
    level_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
  },
});
