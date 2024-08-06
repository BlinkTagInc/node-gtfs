export const timetables = {
  filenameBase: 'timetables',
  filenameExtension: 'txt',
  nonstandard: true,
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true,
      prefix: true,
    },
    {
      name: 'timetable_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'start_date',
      type: 'date',
    },
    {
      name: 'end_date',
      type: 'date',
    },
    {
      name: 'monday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'tuesday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'wednesday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'thursday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'friday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'saturday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'sunday',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'start_time',
      type: 'text',
    },
    {
      name: 'start_timestamp',
      type: 'integer',
    },
    {
      name: 'end_time',
      type: 'text',
    },
    {
      name: 'end_timestamp',
      type: 'integer',
    },
    {
      name: 'timetable_label',
      type: 'text',
      nocase: true,
    },
    {
      name: 'service_notes',
      type: 'text',
      nocase: true,
    },
    {
      name: 'orientation',
      type: 'text',
    },
    {
      name: 'timetable_page_id',
      type: 'text',
    },
    {
      name: 'timetable_sequence',
      type: 'integer',
      min: 0,
      index: true,
    },
    {
      name: 'direction_name',
      type: 'text',
    },
    {
      name: 'include_exceptions',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'show_trip_continuation',
      type: 'integer',
      min: 0,
      max: 1,
    },
  ],
};
