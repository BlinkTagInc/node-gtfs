export const stopVisits = {
  filenameBase: 'stop_visits',
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
      name: 'trip_id_performed',
      type: 'text',
      required: true,
      primary: true,
    },
    {
      name: 'trip_stop_sequence',
      type: 'integer',
      min: 1,
      required: true,
      primary: true,
    },
    {
      name: 'scheduled_stop_sequence',
      type: 'integer',
      min: 0,
    },
    {
      name: 'pattern_id',
      type: 'text',
    },
    {
      name: 'vehicle_id',
      type: 'text',
    },
    {
      name: 'dwell',
      type: 'integer',
      min: 0,
    },
    {
      name: 'stop_id',
      type: 'text',
    },
    {
      name: 'timepoint',
      type: 'text',
    },
    {
      name: 'schedule_arrival_time',
      type: 'text',
    },
    {
      name: 'schedule_departure_time',
      type: 'text',
    },
    {
      name: 'actual_arrival_time',
      type: 'text',
    },
    {
      name: 'actual_departure_time',
      type: 'text',
    },
    {
      name: 'distance',
      type: 'integer',
      min: 0,
    },
    {
      name: 'boarding_1',
      type: 'integer',
      min: 0,
    },
    {
      name: 'alighting_1',
      type: 'integer',
      min: 0,
    },
    {
      name: 'boarding_2',
      type: 'integer',
      min: 0,
    },
    {
      name: 'alighting_2',
      type: 'integer',
      min: 0,
    },
    {
      name: 'departure_load',
      type: 'integer',
      min: 0,
    },
    {
      name: 'door_open',
      type: 'text',
    },
    {
      name: 'door_close',
      type: 'text',
    },
    {
      name: 'door_status',
      type: 'text',
    },
    {
      name: 'ramp_deployed_time',
      type: 'text',
    },
    {
      name: 'ramp_failure',
      type: 'text',
    },
    {
      name: 'kneel_deployed_time',
      type: 'integer',
      min: 0,
    },
    {
      name: 'lift_deployed_time',
      type: 'integer',
      min: 0,
    },
    {
      name: 'bike_rack_deployed',
      type: 'text',
    },
    {
      name: 'bike_load',
      type: 'integer',
      min: 0,
    },
    {
      name: 'revenue',
      type: 'real',
    },
    {
      name: 'number_of_transactions',
      type: 'integer',
      min: 0,
    },
    {
      name: 'schedule_relationship',
      type: 'text',
    },
  ],
};
