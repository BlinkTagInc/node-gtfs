import { defineGtfsTable } from '../../define-table.ts';

export const deadheads = defineGtfsTable({
  file: 'deadheads.txt',
  presence: 'optional',
  primaryKey: ['deadhead_id'],
  fields: {
    deadhead_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    service_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { file: 'calendar.txt', field: 'service_id' },
        { file: 'calendar_dates.txt', field: 'service_id' },
      ],
      applyFeedPrefix: true,
    },
    block_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'trips.txt', field: 'block_id' }],
      applyFeedPrefix: true,
    },
    shape_id: {
      kind: 'id',
      references: [{ file: 'shapes.txt', field: 'shape_id' }],
      applyFeedPrefix: true,
    },
    to_trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    from_trip_id: {
      kind: 'id',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    to_deadhead_id: {
      kind: 'id',
      references: [{ file: 'deadheads.txt', field: 'deadhead_id' }],
      applyFeedPrefix: true,
    },
    from_deadhead_id: {
      kind: 'id',
      references: [{ file: 'deadheads.txt', field: 'deadhead_id' }],
      applyFeedPrefix: true,
    },
  },
  storage: {
    indexes: [
      'block_id',
      'shape_id',
      'to_trip_id',
      'from_trip_id',
      'to_deadhead_id',
      'from_deadhead_id',
    ],
  },
  namespace: 'tods',
});
