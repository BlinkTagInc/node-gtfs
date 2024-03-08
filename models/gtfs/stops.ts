const model = {
  filenameBase: 'stops',
  schema: [
    {
      name: 'stop_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'stop_code',
      type: 'varchar(255)',
    },
    {
      name: 'stop_name',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'tts_stop_name',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'stop_desc',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'stop_lat',
      type: 'real',
      min: -90,
      max: 90,
    },
    {
      name: 'stop_lon',
      type: 'real',
      min: -180,
      max: 180,
    },
    {
      name: 'zone_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'stop_url',
      type: 'varchar(2047)',
    },
    {
      name: 'location_type',
      type: 'integer',
      min: 0,
      max: 4,
    },
    {
      name: 'parent_station',
      type: 'varchar(255)',
      index: true,
    },
    {
      name: 'stop_timezone',
      type: 'varchar(255)',
    },
    {
      name: 'wheelchair_boarding',
      type: 'integer',
      min: 0,
      max: 2,
    },
    {
      name: 'level_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'platform_code',
      type: 'varchar(255)',
    },
  ],
};

export default model;
