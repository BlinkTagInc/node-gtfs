import { defineGtfsTable } from '../../define-table.ts';

export const locations = defineGtfsTable({
  file: 'locations.geojson',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  fields: {
    geojson: { kind: 'text' },
  },
});
