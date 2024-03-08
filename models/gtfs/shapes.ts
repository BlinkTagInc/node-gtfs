const model = {
  filenameBase: 'shapes',
  schema: [
    {
      name: 'shape_id',
      type: 'varchar(255)',
      required: true,
      primary: true,
      prefix: true,
    },
    {
      name: 'shape_pt_lat',
      type: 'real',
      required: true,
      min: -90,
      max: 90,
    },
    {
      name: 'shape_pt_lon',
      type: 'real',
      required: true,
      min: -180,
      max: 180,
    },
    {
      name: 'shape_pt_sequence',
      type: 'integer',
      required: true,
      primary: true,
      min: 0,
    },
    {
      name: 'shape_dist_traveled',
      type: 'real',
      min: 0,
    },
  ],
};

export default model;
