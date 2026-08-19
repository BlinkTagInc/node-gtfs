import { describe, it, expect, withGtfsFixture } from './test-utils.ts';
import Database from 'better-sqlite3';
import { closeDb, advancedQuery } from '../../dist/index.js';

withGtfsFixture();

describe('advancedQuery():', () => {
  it('should honor a top-level db and safely quote identifiers and bind values', () => {
    const explicitDb = new Database(':memory:');
    try {
      explicitDb.exec(
        'CREATE TABLE "odd""table" ("select""ion" TEXT); INSERT INTO "odd""table" VALUES (\'a "quoted" value\');',
      );

      const results = advancedQuery('odd"table', {
        db: explicitDb,
        query: { 'select"ion': 'a "quoted" value' },
        fields: ['odd"table.*'],
      });

      expect(results).toEqual([{ 'select"ion': 'a "quoted" value' }]);
    } finally {
      closeDb(explicitDb);
    }
  });

  it('should reject unsupported join types', () => {
    expect(() =>
      advancedQuery('stop_times', {
        join: [
          {
            type: 'UNSAFE' as 'INNER',
            table: 'trips',
            on: 'stop_times.trip_id=trips.trip_id',
          },
        ],
      }),
    ).toThrow(/Unsupported SQL join type/);
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
          type: 'INNER' as const,
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
          type: 'INNER' as const,
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
