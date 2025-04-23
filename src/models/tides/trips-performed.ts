export const tripsPerformed = {
  filenameBase: 'trips_performed',
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
      name: 'vehicle_id',
      type: 'text',
      required: true,
    },
    {
      name: 'trip_id_scheduled',
      type: 'text',
    },
    {
      name: 'route_id',
      type: 'text',
    },
    {
      name: 'route_type',
      type: 'text',
    },
    {
      name: 'ntd_mode',
      type: 'text',
    },
    {
      name: 'route_type_agency',
      type: 'text',
    },
    {
      name: 'shape_id',
      type: 'text',
    },
    {
      name: 'pattern_id',
      type: 'text',
    },
    {
      name: 'direction_id',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'operator_id',
      type: 'text',
    },
    {
      name: 'block_id',
      type: 'text',
    },
    {
      name: 'trip_start_stop_id',
      type: 'text',
    },
    {
      name: 'trip_end_stop_id',
      type: 'text',
    },
    {
      name: 'schedule_trip_start',
      type: 'text',
    },
    {
      name: 'schedule_trip_end',
      type: 'text',
    },
    {
      name: 'actual_trip_start',
      type: 'text',
    },
    {
      name: 'actual_trip_end',
      type: 'text',
    },
    {
      name: 'trip_type',
      type: 'text',
    },
    {
      name: 'schedule_relationship',
      type: 'text',
    },
  ],
};
