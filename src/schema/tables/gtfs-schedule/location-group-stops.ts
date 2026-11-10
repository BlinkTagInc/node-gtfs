import { defineGtfsDomainTable } from '../../domain-table.ts';

export const locationGroupStops = defineGtfsDomainTable({
  filename: 'location_group_stops.txt',
  tableName: 'location_group_stops',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['location_group_id', 'stop_id'],
  fields: {
    location_group_id: {
      kind: 'id',
      references: [
        {
          targetFilename: 'location_groups.txt',
          targetField: 'location_group_id',
        },
      ],
      presence: 'required',
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
      presence: 'required',
    },
  },
});
