export const stationActivities = {
  filenameBase: 'station_activities',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'tides',
  schema: [
    {
      name: 'service_date',
      type: 'date',
      required: true,
      primary: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'time_period_start',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'time_period_end',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'time_period_category',
      type: 'text',
    },
    {
      name: 'total_entries',
      type: 'integer',
      min: 0,
    },
    {
      name: 'total_exits',
      type: 'integer',
      min: 0,
    },
    {
      name: 'number_of_transactions',
      type: 'integer',
      min: 0,
    },
    {
      name: 'bike_entries',
      type: 'integer',
      min: 0,
    },
    {
      name: 'bike_exits',
      type: 'integer',
      min: 0,
    },
    {
      name: 'ramp_entries',
      type: 'integer',
      min: 0,
    },
    {
      name: 'ramp_exits',
      type: 'integer',
      min: 0,
    },
  ],
};
