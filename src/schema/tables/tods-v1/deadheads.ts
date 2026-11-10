import { defineGtfsDomainTable } from '../../domain-table.ts';

export const deadheads = defineGtfsDomainTable({
  filename: 'deadheads.txt',
  tableName: 'deadheads',
  presence: 'optional',
  primaryKey: ['deadhead_id'],
  fields: {
    deadhead_id: { kind: 'id', presence: 'required' },
    service_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'calendar.txt', targetField: 'service_id' },
        { targetFilename: 'calendar_dates.txt', targetField: 'service_id' },
      ],
    },
    block_id: {
      kind: 'id',
      presence: 'required',
      references: [{ targetFilename: 'trips.txt', targetField: 'block_id' }],
    },
    shape_id: {
      kind: 'id',
      references: [{ targetFilename: 'shapes.txt', targetField: 'shape_id' }],
    },
    to_trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    from_trip_id: {
      kind: 'id',
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    to_deadhead_id: {
      kind: 'id',
      references: [
        { targetFilename: 'deadheads.txt', targetField: 'deadhead_id' },
      ],
    },
    from_deadhead_id: {
      kind: 'id',
      references: [
        { targetFilename: 'deadheads.txt', targetField: 'deadhead_id' },
      ],
    },
  },
  specification: 'tods-v1',
});
