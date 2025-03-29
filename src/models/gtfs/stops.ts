export const stops = {
  filenameBase: 'stops',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'stop_id',
      type: 'text',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'stop_code',
      type: 'text',
    },
    {
      name: 'stop_name',
      type: 'text',
      nocase: true,
    },
    {
      name: 'tts_stop_name',
      type: 'text',
      nocase: true,
    },
    {
      name: 'stop_desc',
      type: 'text',
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
      type: 'text',
      prefix: true,
    },
    {
      name: 'stop_url',
      type: 'text',
    },
    {
      name: 'location_type',
      type: 'integer',
      min: 0,
      max: 4,
    },
    {
      name: 'parent_station',
      type: 'text',
      index: true,
      prefix: true,
    },
    {
      name: 'stop_timezone',
      type: 'text',
    },
    {
      name: 'wheelchair_boarding',
      type: 'integer',
      min: 0,
      max: 2,
    },
    {
      name: 'level_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'platform_code',
      type: 'text',
    },
  ],
};
