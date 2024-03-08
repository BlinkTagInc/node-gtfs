const model = {
  filenameBase: 'timetables',
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
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
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
      type: 'integer',
    },
    {
      name: 'end_date',
      type: 'integer',
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
      type: 'varchar(255)',
    },
    {
      name: 'start_timestamp',
      type: 'integer',
    },
    {
      name: 'end_time',
      type: 'varchar(255)',
    },
    {
      name: 'end_timestamp',
      type: 'integer',
    },
    {
      name: 'timetable_label',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'service_notes',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'orientation',
      type: 'varchar(255)',
    },
    {
      name: 'timetable_page_id',
      type: 'varchar(255)',
    },
    {
      name: 'timetable_sequence',
      type: 'integer',
      min: 0,
      index: true,
    },
    {
      name: 'direction_name',
      type: 'varchar(255)',
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

export default model;
