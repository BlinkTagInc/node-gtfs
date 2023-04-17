const model = {
  filenameBase: 'pathways',
  schema: [
    {
      name: 'pathway_id',
      type: 'varchar(255)',
      primary: true,
      required: true,
      prefix: true,
    },
    {
      name: 'from_stop_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
    },
    {
      name: 'to_stop_id',
      type: 'varchar(255)',
      required: true,
      prefix: true,
    },
    {
      name: 'pathway_mode',
      type: 'integer',
      required: true,
      min: 1,
      max: 7,
    },
    {
      name: 'is_bidirectional',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
    },
    {
      name: 'length',
      type: 'real',
      min: 0,
    },
    {
      name: 'traversal_time',
      type: 'integer',
      min: 0,
    },
    {
      name: 'stair_count',
      type: 'integer',
    },
    {
      name: 'max_slope',
      type: 'real',
    },
    {
      name: 'min_width',
      type: 'real',
      min: 0,
    },
    {
      name: 'signposted_as',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'reversed_signposted_as',
      type: 'varchar(255)',
      nocase: true,
    },
  ],
};

export default model;
