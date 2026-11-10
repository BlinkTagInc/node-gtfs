import { defineGtfsDomainTable } from '../../domain-table.ts';
import {
  createTodsSupplementFields,
  todsDeleteField,
} from '../../tods-supplement.ts';
import { stopTimes } from '../gtfs-schedule/stop-times.ts';

export const stopTimesSupplement = defineGtfsDomainTable({
  filename: 'stop_times_supplement.txt',
  tableName: 'stop_times_supplement',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['trip_id', 'stop_sequence'],
  fields: {
    ...createTodsSupplementFields(stopTimes, ['trip_id', 'stop_sequence']),
    TODS_delete: todsDeleteField,
  },
});
