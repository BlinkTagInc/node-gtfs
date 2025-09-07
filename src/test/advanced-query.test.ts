import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  advancedQuery,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('advancedQuery():', () => {
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

    expect(results).toHaveLength(0);
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

    const expectedResult = [
      { trip_id: '329', arrival_time: '07:56:00' },
      { trip_id: '329', arrival_time: '08:03:00' },
      { trip_id: '329', arrival_time: '08:16:00' },
      { trip_id: '329', arrival_time: '08:27:00' },
      { trip_id: '329', arrival_time: '08:35:00' },
      { trip_id: '329', arrival_time: '08:44:00' },
      { trip_id: '329', arrival_time: '08:52:00' },
      { trip_id: '329', arrival_time: '09:09:00' },
    ];

    expect(results).toHaveLength(8);
    expect(results).toEqual(expectedResult);
  });
});
