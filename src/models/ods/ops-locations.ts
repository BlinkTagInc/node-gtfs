export const opsLocations = {
  filenameBase: 'ops_locations',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'ops_location_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'ops_location_code',
      type: 'text',
    },
    {
      name: 'ops_location_name',
      type: 'text',
      required: true,
      nocase: true,
    },
    {
      name: 'ops_location_desc',
      type: 'text',
      nocase: true,
    },
    {
      name: 'ops_location_lat',
      type: 'real',
      required: true,
      min: -90,
      max: 90,
    },
    {
      name: 'ops_location_lon',
      type: 'real',
      required: true,
      min: -180,
      max: 180,
    },
  ],
};
