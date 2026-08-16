import { defineGtfsTable } from '../../define-table.ts';

export const deadheadTimes = defineGtfsTable({
  file: 'deadhead_times.txt',
  presence: 'optional',
  primaryKey: ['deadhead_id', 'location_sequence'],
  fields: {
    deadhead_id: {
      kind: 'id',
      presence: 'required',
      references: [{ file: 'deadheads.txt', field: 'deadhead_id' }],
      applyFeedPrefix: true,
    },
    arrival_time: { kind: 'time', presence: 'required' },
    departure_time: { kind: 'time', presence: 'required' },
    ops_location_id: {
      kind: 'id',
      references: [{ file: 'ops_locations.txt', field: 'ops_location_id' }],
      applyFeedPrefix: true,
    },
    stop_id: {
      kind: 'id',
      references: [{ file: 'stops.txt', field: 'stop_id' }],
      applyFeedPrefix: true,
    },
    location_sequence: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    shape_dist_traveled: { kind: 'real', minimum: 0 },
  },
  storage: {
    indexes: [
      'deadhead_id',
      'arrival_timestamp',
      'departure_timestamp',
      'location_sequence',
    ],
  },
  namespace: 'tods',
});
