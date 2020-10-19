module.exports = {
  filenameBase: 'attributions',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'attribution_id',
      type: 'varchar(255)'
    },
    {
      name: 'agency_id',
      type: 'varchar(255)'
    },
    {
      name: 'route_id',
      type: 'varchar(255)'
    },
    {
      name: 'trip_id',
      type: 'varchar(255)'
    },
    {
      name: 'organization_name',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'is_producer',
      type: 'integer',
      min: 0,
      max: 1
    },
    {
      name: 'is_operator',
      type: 'integer',
      min: 0,
      max: 1
    },
    {
      name: 'is_authority',
      type: 'integer',
      min: 0,
      max: 1
    },
    {
      name: 'attribution_url',
      type: 'varchar(2047)'
    },
    {
      name: 'attribution_email',
      type: 'varchar(255)'
    },
    {
      name: 'attribution_phone',
      type: 'varchar(255)'
    }
  ]
};
