import { defineGtfsDomainTable } from '../../domain-table.ts';

const recordIdReferences = [
  ['agency', 'agency.txt', 'agency_id'],
  ['stops', 'stops.txt', 'stop_id'],
  ['routes', 'routes.txt', 'route_id'],
  ['trips', 'trips.txt', 'trip_id'],
  ['stop_times', 'stop_times.txt', 'trip_id'],
  ['pathways', 'pathways.txt', 'pathway_id'],
  ['levels', 'levels.txt', 'level_id'],
  ['attributions', 'attributions.txt', 'attribution_id'],
  ['calendar', 'calendar.txt', 'service_id'],
  ['calendar_dates', 'calendar_dates.txt', 'service_id'],
  ['fare_attributes', 'fare_attributes.txt', 'fare_id'],
  ['fare_rules', 'fare_rules.txt', 'fare_id'],
  ['shapes', 'shapes.txt', 'shape_id'],
  ['frequencies', 'frequencies.txt', 'trip_id'],
  ['transfers', 'transfers.txt', 'from_stop_id'],
] as const;

const recordSubIdReferences = [
  ['stop_times', 'stop_times.txt', 'stop_sequence'],
  ['calendar_dates', 'calendar_dates.txt', 'date'],
  ['fare_rules', 'routes.txt', 'route_id'],
  ['frequencies', 'frequencies.txt', 'start_time'],
  ['transfers', 'stops.txt', 'stop_id'],
] as const;

export const translations = defineGtfsDomainTable({
  filename: 'translations.txt',
  tableName: 'translations',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: [
    'table_name',
    'field_name',
    'language',
    'record_id',
    'record_sub_id',
    'field_value',
  ],
  fields: {
    table_name: { kind: 'text', presence: 'required' },
    field_name: { kind: 'text', presence: 'required' },
    language: { kind: 'text', presence: 'required' },
    translation: { kind: 'text', presence: 'required' },
    record_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: recordIdReferences.map(([tableName, file, field]) => ({
        targetFilename: file,
        targetField: field,
        relationship: 'polymorphic' as const,
        when: { field: 'table_name', equals: tableName },
      })),
    },
    record_sub_id: {
      kind: 'id',
      presence: 'conditionally-required',
      references: recordSubIdReferences.map(([tableName, file, field]) => ({
        targetFilename: file,
        targetField: field,
        relationship: 'polymorphic' as const,
        when: { field: 'table_name', equals: tableName },
      })),
      normalization: [
        {
          kind: 'source-reference',
          when: {
            field: 'table_name',
            in: ['fare_rules', 'transfers'],
          },
        },
      ],
    },
    field_value: { kind: 'text', presence: 'conditionally-required' },
  },
});
