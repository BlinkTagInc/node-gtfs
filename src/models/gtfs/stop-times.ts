export const stopTimes = {
  filenameBase: 'stop_times',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'trip_id',
      type: 'text',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'arrival_time',
      type: 'time',
    },
    {
      name: 'departure_time',
      type: 'time',
    },
    {
      name: 'location_group_id',
      type: 'text',
      prefix: true,
      index: true,
    },
    {
      name: 'location_id',
      type: 'text',
      prefix: true,
      index: true,
    },
    {
      name: 'stop_id',
      type: 'text',
      required: true,
      prefix: true,
      index: true,
    },
    {
      name: 'stop_sequence',
      type: 'integer',
      required: true,
      primary: true,
      min: 0,
    },
    {
      name: 'stop_headsign',
      type: 'text',
      nocase: true,
    },
    {
      name: 'start_pickup_drop_off_window',
      type: 'time',
    },
    {
      name: 'pickup_type',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'drop_off_type',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'continuous_pickup',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'continuous_drop_off',
      type: 'integer',
      min: 0,
      max: 3,
    },
    {
      name: 'shape_dist_traveled',
      type: 'real',
      min: 0,
    },
    {
      name: 'timepoint',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'pickup_booking_rule_id',
      type: 'text',
      prefix: true,
      index: true,
    },
    {
      name: 'drop_off_booking_rule_id',
      type: 'text',
      prefix: true,
      index: true,
    },
  ],
};
