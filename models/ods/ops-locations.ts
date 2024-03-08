const model = {
  filenameBase: 'ops_locations',
  nonstandard: true,
  extension: 'ods',
  schema: [
    {
      name: 'ops_location_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'ops_location_code',
      type: 'varchar(255)',
    },
    {
      name: 'ops_location_name',
      type: 'varchar(255)',
      required: true,
      nocase: true,
    },
    {
      name: 'ops_location_desc',
      type: 'varchar(255)',
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

export default model;
