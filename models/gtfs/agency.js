module.exports = {
  filenameBase: 'agency',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'agency_id',
      type: 'varchar(255)'
    },
    {
      name: 'agency_name',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'agency_url',
      type: 'varchar(2047)',
      required: true
    },
    {
      name: 'agency_timezone',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'agency_lang',
      type: 'varchar(255)'
    },
    {
      name: 'agency_phone',
      type: 'varchar(64)'
    },
    {
      name: 'agency_fare_url',
      type: 'varchar(2047)'
    },
    {
      name: 'agency_email',
      type: 'varchar(255)'
    }
  ]
};
