import { defineGtfsTable } from '../../define-table.ts';

export const locationGroupStops = defineGtfsTable({
  file: 'location_group_stops.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['location_group_id', 'stop_id'],
  fields: {
    location_group_id: {
      kind: 'id',
      references: [{ file: 'location_groups.txt', field: 'location_group_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      presence: 'required',
      applyFeedPrefix: true,
    },
  },
  storage: {
    indexes: ['location_group_id', 'stop_id'],
  },
});
