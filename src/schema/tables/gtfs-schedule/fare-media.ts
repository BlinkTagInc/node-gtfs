import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareMedia = defineGtfsDomainTable({
  filename: 'fare_media.txt',
  tableName: 'fare_media',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['fare_media_id'],
  fields: {
    fare_media_id: { kind: 'id', presence: 'required' },
    fare_media_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
    fare_media_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 4,
    },
  },
});
