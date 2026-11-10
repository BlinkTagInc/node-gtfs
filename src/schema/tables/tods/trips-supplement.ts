import { defineGtfsDomainTable } from '../../domain-table.ts';
import {
  createTodsSupplementFields,
  todsDeleteField,
} from '../../tods-supplement.ts';
import { trips } from '../gtfs-schedule/trips.ts';

export const tripsSupplement = defineGtfsDomainTable({
  filename: 'trips_supplement.txt',
  tableName: 'trips_supplement',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['trip_id'],
  fields: {
    ...createTodsSupplementFields(trips, ['trip_id']),
    TODS_delete: todsDeleteField,
    TODS_trip_type: { kind: 'text' },
  },
});
