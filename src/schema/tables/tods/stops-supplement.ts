import { defineGtfsDomainTable } from '../../domain-table.ts';
import {
  createTodsSupplementFields,
  todsDeleteField,
} from '../../tods-supplement.ts';
import { stops } from '../gtfs-schedule/stops.ts';

export const stopsSupplement = defineGtfsDomainTable({
  filename: 'stops_supplement.txt',
  tableName: 'stops_supplement',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['stop_id'],
  fields: {
    ...createTodsSupplementFields(stops, ['stop_id']),
    TODS_delete: todsDeleteField,
    TODS_location_type: { kind: 'text' },
  },
});
