import { describe, it, expect, withGtfsFixture } from './test-utils.ts';
import {
  advancedQuery,
  getStops,
  getStoptimes,
  getTrips,
} from '../../dist/index.js';

withGtfsFixture();

describe('Query value types:', () => {
  it('should match a text column queried with a number', () => {
    const stringResults = getTrips({ trip_short_name: '2' }, ['trip_id']);
    const numberResults = getTrips(
      { trip_short_name: 2 as unknown as string },
      ['trip_id'],
    );

    expect(stringResults.length).toBeGreaterThan(0);
    expect(numberResults).toEqual(stringResults);
  });

  it('should match an id column queried with a number', () => {
    const results = getTrips({ trip_id: 101 as unknown as string }, [
      'trip_id',
    ]);

    expect(results).toEqual([{ trip_id: '101' }]);
  });

  it('should match a text column queried with an array of numbers', () => {
    const results = getTrips(
      { trip_id: [101, 102] as unknown as string[] },
      ['trip_id'],
      [['trip_id', 'ASC']],
    );

    expect(results).toEqual([{ trip_id: '101' }, { trip_id: '102' }]);
  });

  it('should match a text column in a subquery queried with a number', () => {
    const stringResults = getStops({ trip_id: '101' }, ['stop_id']);
    const numberResults = getStops({ trip_id: 101 as unknown as string }, [
      'stop_id',
    ]);

    expect(stringResults.length).toBeGreaterThan(0);
    expect(numberResults).toEqual(stringResults);
  });

  it('should match an integer column queried with a numeric string', () => {
    const numberResults = getTrips({ direction_id: 0 }, ['trip_id']);
    const stringResults = getTrips({ direction_id: '0' as unknown as number }, [
      'trip_id',
    ]);

    expect(numberResults.length).toBeGreaterThan(0);
    expect(stringResults).toEqual(numberResults);
  });

  it('should return integer columns as numbers', () => {
    const results = getStoptimes({ trip_id: 101 as unknown as string }, [
      'stop_sequence',
    ]);

    expect(results.length).toBeGreaterThan(0);
    expect(typeof results[0].stop_sequence).toBe('number');
  });

  it('should match a text column queried with a number in advancedQuery', () => {
    const results = advancedQuery('trips', {
      query: { trip_id: 101 },
      fields: ['trip_id'],
    });

    expect(results).toEqual([{ trip_id: '101' }]);
  });
});
