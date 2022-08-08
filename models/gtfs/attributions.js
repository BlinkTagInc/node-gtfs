const model = {
  filenameBase: 'attributions',
  schema: [
    {
      name: 'attribution_id',
      type: 'varchar(255)',
      primary: true,
    },
    {
      name: 'agency_id',
      type: 'varchar(255)',
    },
    {
      name: 'route_id',
      type: 'varchar(255)',
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
    },
    {
      name: 'organization_name',
      type: 'varchar(255)',
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
      type: 'varchar(2047)',
    },
    {
      name: 'attribution_email',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'attribution_phone',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
