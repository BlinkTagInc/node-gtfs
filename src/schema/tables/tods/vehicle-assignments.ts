import { defineGtfsDomainTable } from '../../domain-table.ts';

export const vehicleAssignments = defineGtfsDomainTable({
  filename: 'vehicle_assignments.txt',
  tableName: 'vehicle_assignments',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['date', 'block_id', 'service_id'],
  fields: {
    date: { kind: 'date', presence: 'required' },
    service_id: {
      kind: 'id',
      references: [
        { targetFilename: 'calendar.txt', targetField: 'service_id' },
        { targetFilename: 'calendar_dates.txt', targetField: 'service_id' },
        {
          targetFilename: 'calendar_supplement.txt',
          targetField: 'service_id',
        },
        {
          targetFilename: 'calendar_dates_supplement.txt',
          targetField: 'service_id',
        },
      ],
    },
    block_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'trips.txt', targetField: 'block_id' },
        { targetFilename: 'trips_supplement.txt', targetField: 'block_id' },
      ],
    },
    vehicle_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'vehicles.txt', targetField: 'vehicle_id' },
      ],
    },
  },
});
