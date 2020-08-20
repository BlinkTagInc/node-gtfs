module.exports = {
  filenameBase: 'shapes',
  schema: [
    {
      name: 'id',
      type: 'integer',
      primary: true
    },
    {
      name: 'shape_id',
      type: 'varchar(255)',
      required: true,
      index: true
    },
    {
      name: 'shape_pt_lat',
      type: 'real',
      required: true,
      min: -90,
      max: 90
    },
    {
      name: 'shape_pt_lon',
      type: 'real',
      required: true,
      min: -180,
      max: 180
    },
    {
      name: 'shape_pt_sequence',
      type: 'integer',
      required: true,
      min: 0
    },
    {
      name: 'shape_dist_traveled',
      type: 'real',
      min: 0
    }
  ]
};
