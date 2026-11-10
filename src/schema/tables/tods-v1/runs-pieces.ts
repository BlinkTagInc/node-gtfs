import { defineGtfsDomainTable } from '../../domain-table.ts';

export const runsPieces = defineGtfsDomainTable({
  filename: 'runs_pieces.txt',
  tableName: 'runs_pieces',
  presence: 'optional',
  primaryKey: ['piece_id'],
  fields: {
    run_id: { kind: 'id', presence: 'required' },
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
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
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
      references: [{ targetFilename: 'trips.txt', targetField: 'trip_id' }],
    },
    end_trip_position: { kind: 'integer', minimum: 0 },
  },
  specification: 'tods-v1',
});
