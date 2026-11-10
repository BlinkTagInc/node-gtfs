import { defineGtfsDomainTable } from '../../domain-table.ts';

export const stopAreas = defineGtfsDomainTable({
  filename: 'stop_areas.txt',
  tableName: 'stop_areas',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['area_id', 'stop_id'],
  fields: {
    area_id: {
      kind: 'id',
      references: [{ targetFilename: 'areas.txt', targetField: 'area_id' }],
      presence: 'required',
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
      presence: 'required',
    },
  },
});
