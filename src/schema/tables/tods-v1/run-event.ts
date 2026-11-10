import { defineGtfsDomainTable } from '../../domain-table.ts';

export const runEvent = defineGtfsDomainTable({
  filename: 'run_event.txt',
  tableName: 'run_event',
  presence: 'optional',
  primaryKey: ['run_event_id'],
  fields: {
    run_event_id: { kind: 'id', presence: 'required' },
    piece_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'runs_pieces.txt', targetField: 'piece_id' },
      ],
    },
    event_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    event_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
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
        { targetFilename: 'stops.txt', targetField: 'stop_id' },
        { targetFilename: 'ops_locations.txt', targetField: 'ops_location_id' },
      ],
    },
    event_to_location_type: {
      kind: 'integer',
      minimum: 0,
      maximum: 1,
    },
    event_to_location_id: {
      kind: 'id',
      references: [
        { targetFilename: 'stops.txt', targetField: 'stop_id' },
        { targetFilename: 'ops_locations.txt', targetField: 'ops_location_id' },
      ],
    },
  },
  specification: 'tods-v1',
});
