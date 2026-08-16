import { defineGtfsTable } from '../../define-table.ts';

export const runsPieces = defineGtfsTable({
  file: 'runs_pieces.txt',
  presence: 'optional',
  primaryKey: ['piece_id'],
  fields: {
    run_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    piece_id: { kind: 'id', presence: 'required' },
    start_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 2,
    },
    start_trip_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    start_trip_position: { kind: 'integer', minimum: 0 },
    end_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 2,
    },
    end_trip_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'trips.txt', field: 'trip_id' }],
      applyFeedPrefix: true,
    },
    end_trip_position: { kind: 'integer', minimum: 0 },
  },
  storage: {
    indexes: ['start_type', 'start_trip_id', 'end_type', 'end_trip_id'],
  },
  namespace: 'tods',
});
