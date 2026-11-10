import { defineGtfsDomainTable } from '../../domain-table.ts';

export const fareRules = defineGtfsDomainTable({
  filename: 'fare_rules.txt',
  tableName: 'fare_rules',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'fare_id',
    'route_id',
    'origin_id',
    'destination_id',
    'contains_id',
  ],
  fields: {
    fare_id: {
      kind: 'id',
      references: [
        { targetFilename: 'fare_attributes.txt', targetField: 'fare_id' },
      ],
      presence: 'required',
    },
    route_id: {
      kind: 'id',
      references: [{ targetFilename: 'routes.txt', targetField: 'route_id' }],
    },
    origin_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'zone_id' }],
    },
    destination_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'zone_id' }],
    },
    contains_id: {
      kind: 'id',
      references: [{ targetFilename: 'stops.txt', targetField: 'zone_id' }],
    },
  },
});
