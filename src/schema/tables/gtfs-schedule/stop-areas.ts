import { defineGtfsTable } from '../../define-table.ts';

export const stopAreas = defineGtfsTable({
  file: 'stop_areas.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['area_id', 'stop_id'],
  fields: {
    area_id: {
      kind: 'id',
      references: [{ file: 'areas.txt', field: 'area_id' }],
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
    indexes: ['stop_id'],
  },
});
