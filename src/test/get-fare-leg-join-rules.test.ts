import {
  afterAll,
  beforeAll,
  createFeedFixture,
  describe,
  expect,
  it,
  type FeedFixture,
} from './test-utils.ts';
import {
  closeDb,
  getFareLegJoinRules,
  importGtfs,
  openDb,
} from '../../dist/index.js';

let fixture: FeedFixture;

beforeAll(async () => {
  fixture = await createFeedFixture({
    base: 'none',
    extraFiles: {
      'fare_leg_join_rules.txt': [
        'from_network_id,to_network_id,from_stop_id,to_stop_id',
        'network-1,network-2,stop-1,stop-2',
        'network-2,network-3,,',
        '',
      ].join('\n'),
    },
  });

  openDb();
  await importGtfs({
    agencies: [{ path: fixture.path }],
    logLevel: 'silent',
  });
});

afterAll(async () => {
  closeDb(openDb());
  await fixture.cleanup();
});

describe('getFareLegJoinRules():', () => {
  it('should import and return fare leg join rules', () => {
    const results = getFareLegJoinRules({}, [], [['from_network_id', 'ASC']]);

    expect(results).toEqual([
      {
        from_network_id: 'network-1',
        to_network_id: 'network-2',
        from_stop_id: 'stop-1',
        to_stop_id: 'stop-2',
      },
      {
        from_network_id: 'network-2',
        to_network_id: 'network-3',
        from_stop_id: null,
        to_stop_id: null,
      },
    ]);
  });

  it('should filter and select fields', () => {
    const results = getFareLegJoinRules({ from_network_id: 'network-1' }, [
      'from_stop_id',
      'to_stop_id',
    ]);

    expect(results).toEqual([{ from_stop_id: 'stop-1', to_stop_id: 'stop-2' }]);
  });
});
