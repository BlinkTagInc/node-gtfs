/* eslint-env mocha */

import should from 'should';

import config from '../test-config.js';
import { openDb, closeDb, importGtfs, advancedQuery } from '../../index.js';

describe('advancedQuery():', () => {
  before(async () => {
    openDb(config);
    await importGtfs(config);
  });

  after(() => {
    const db = openDb(config);
    closeDb(db);
  });

  it('should return empty array if no trips', () => {
    const routeId = 'fake-route-id';

    const advancedQueryOptions = {
      query: {
        route_id: routeId,
      },
      fields: ['stop_times.trip_id', 'arrival_time'],
      join: [
        {
          type: 'INNER',
          table: 'trips',
          on: 'stop_times.trip_id=trips.trip_id',
        },
      ],
    };
    const results = advancedQuery('stop_times', advancedQueryOptions);

    should.exists(results);
    results.should.have.length(0);
  });

  it('should return expected trips with joined trip', () => {
    const tripId = '329';

    const advancedQueryOptions = {
      query: {
        'stop_times.trip_id': tripId,
      },
      fields: ['stop_times.trip_id', 'arrival_time'],
      join: [
        {
          type: 'INNER',
          table: 'trips',
          on: 'stop_times.trip_id=trips.trip_id',
        },
      ],
    };
    const results = advancedQuery('stop_times', advancedQueryOptions);

    const expectedResults = [
      { trip_id: '329', arrival_time: '7:56:00' },
      { trip_id: '329', arrival_time: '8:03:00' },
      { trip_id: '329', arrival_time: '8:16:00' },
      { trip_id: '329', arrival_time: '8:27:00' },
      { trip_id: '329', arrival_time: '8:35:00' },
      { trip_id: '329', arrival_time: '8:44:00' },
      { trip_id: '329', arrival_time: '8:52:00' },
      { trip_id: '329', arrival_time: '9:09:00' },
    ];

    should.exist(results);
    results.length.should.equal(8);
    expectedResults.should.match(results);
  });
});
