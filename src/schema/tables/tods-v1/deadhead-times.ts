import { defineGtfsDomainTable } from '../../domain-table.ts';

export const deadheadTimes = defineGtfsDomainTable({
  filename: 'deadhead_times.txt',
  tableName: 'deadhead_times',
  presence: 'optional',
  primaryKey: ['deadhead_id', 'location_sequence'],
  fields: {
    deadhead_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'deadheads.txt', targetField: 'deadhead_id' },
      ],
    },
    arrival_time: { kind: 'time', presence: 'required' },
    departure_time: { kind: 'time', presence: 'required' },
    ops_location_id: {
      kind: 'id',
      references: [
        { targetFilename: 'ops_locations.txt', targetField: 'ops_location_id' },
      ],
    },
    stop_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'stop_id' }],
    },
    location_sequence: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
    },
    shape_dist_traveled: { kind: 'real', minimum: 0 },
  },
  specification: 'tods-v1',
});
