import path from 'node:path';

const config = {
  agencies: [
    {
      path: path.join(import.meta.dirname, 'fixture/caltrain_20160406.zip'),
    },
  ],
  verbose: false,
};

export default config;
