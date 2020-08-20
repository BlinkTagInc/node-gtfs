module.exports = {
  filenameBase: 'frequencies',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'trip_id',
      type: 'varchar(255)',
      required: true,
      index: true
    },
    {
      name: 'start_time',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'start_timestamp',
      type: 'integer'
    },
    {
      name: 'end_time',
      type: 'varchar(255)',
      required: true
    },
    {
      name: 'end_timestamp',
      type: 'integer'
    },
    {
      name: 'headway_secs',
      type: 'integer',
      required: true,
      min: 0
    },
    {
      name: 'exact_times',
      type: 'integer',
      min: 0,
      max: 1
    }
  ]
};
