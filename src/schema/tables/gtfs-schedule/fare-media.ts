import { defineGtfsTable } from '../../define-table.ts';

export const fareMedia = defineGtfsTable({
  file: 'fare_media.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['fare_media_id'],
  fields: {
    fare_media_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    fare_media_name: { kind: 'text', caseInsensitiveComparison: true },
    fare_media_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 4,
    },
  },
});
