export const attributions = {
  filenameBase: 'attributions',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'attribution_id',
      type: 'text',
      prefix: true,
      primary: true,
    },
    {
      name: 'agency_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'route_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'trip_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'organization_name',
      type: 'text',
      required: true,
      nocase: true,
    },
    {
      name: 'is_producer',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'is_operator',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'is_authority',
      type: 'integer',
      min: 0,
      max: 1,
    },
    {
      name: 'attribution_url',
      type: 'text',
    },
    {
      name: 'attribution_email',
      type: 'text',
      nocase: true,
    },
    {
      name: 'attribution_phone',
      type: 'text',
      nocase: true,
    },
  ],
};
