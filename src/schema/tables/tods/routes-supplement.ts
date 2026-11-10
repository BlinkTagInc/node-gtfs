import { defineGtfsDomainTable } from '../../domain-table.ts';
import {
  createTodsSupplementFields,
  todsDeleteField,
} from '../../tods-supplement.ts';
import { routes } from '../gtfs-schedule/routes.ts';

export const routesSupplement = defineGtfsDomainTable({
  filename: 'routes_supplement.txt',
  tableName: 'routes_supplement',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['route_id'],
  fields: {
    ...createTodsSupplementFields(routes, ['route_id']),
    TODS_delete: todsDeleteField,
  },
});
