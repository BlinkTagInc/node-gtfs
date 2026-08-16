import { defineGtfsTable } from '../../define-table.ts';

export const runEvents = defineGtfsTable({
  file: 'run_event.txt',
  presence: 'optional',
  primaryKey: ['run_event_id'],
  fields: {
    run_event_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
    piece_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'runs_pieces.txt', field: 'piece_id' }],
      applyFeedPrefix: true,
    },
    event_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    event_name: { kind: 'text', caseInsensitiveComparison: true },
    event_time: { kind: 'text', presence: 'required' },
    event_duration: { kind: 'integer', presence: 'required', minimum: 0 },
    event_from_location_type: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
    },
    event_from_location_id: {
      kind: 'id',
      references: [
        { file: 'stops.txt', field: 'stop_id' },
        { file: 'ops_locations.txt', field: 'ops_location_id' },
      ],
      applyFeedPrefix: true,
    },
    event_to_location_type: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
    },
    event_to_location_id: {
      kind: 'id',
      references: [
        { file: 'stops.txt', field: 'stop_id' },
        { file: 'ops_locations.txt', field: 'ops_location_id' },
      ],
      applyFeedPrefix: true,
    },
  },
  storage: {
    indexes: [
      'event_type',
      'event_from_location_type',
      'event_to_location_type',
    ],
  },
  namespace: 'tods',
});
