import { fixtureExtensions } from '../fixtures/extensions.ts';

const config = {
  database: {},
  sources: [
    {
      sourceId: 'caltrain',
      schedule: { path: 'test/fixtures/caltrain_20160406.zip' },
    },
  ] as const,
  extensions: fixtureExtensions,
  reporting: { level: 'silent' as const },
};

export default config;
