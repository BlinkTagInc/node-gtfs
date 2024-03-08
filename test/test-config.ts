import path from 'node:path';
import { fileURLToPath } from 'node:url';

const config = {
  agencies: [
    {
      path: path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        'fixture/caltrain_20160406.zip'
      ),
    },
  ],
  verbose: false,
};

export default config;
