import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getStoptimes } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getStoptimes():', () => {
  it('should return an empty array if no stoptimes exist for given agency', () => {
    const stopId = 'fake-stop-id';

    const results = getStoptimes({
      stop_id: stopId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return array of stoptimes for given stop_id', () => {
    const stopId = '70011';

    const results = getStoptimes({
      stop_id: stopId,
    });

    expect(results).toHaveLength(80);

    for (const result of results) {
      expect(result.stop_id).toEqual(stopId);
    }
  });

  it('should return array of stoptimes for given trip_id ordered by stop_sequence', () => {
    const tripId = '421a';

    const results = getStoptimes(
      {
        trip_id: tripId,
      },
      [],
      [['stop_sequence', 'ASC']],
    );

    expect(results).toHaveLength(24);

    let lastStopSequence;
    for (const result of results) {
      expect(result.trip_id).toEqual(tripId);
      if (lastStopSequence !== undefined) {
        expect(result.stop_sequence).toBeGreaterThan(lastStopSequence);
      }

      lastStopSequence = result.stop_sequence;
    }
  });

  it('should return array of stoptimes for a given date and stop_id', () => {
    const date = 20160704;

    const results = getStoptimes(
      {
        date,
        stop_id: '777403',
      },
      [],
      [['arrival_timestamp', 'ASC']],
    );

    expect(results).toHaveLength(29);

    expect(results[0].trip_id).toEqual('23u');
  });

  it('should return array of stoptimes for a given date, start_time and stop_id', () => {
    const date = 20160704;

    const results = getStoptimes(
      {
        date,
        stop_id: '777403',
        start_time: '15:30:00',
      },
      [],
      [['arrival_timestamp', 'ASC']],
    );

    expect(results).toHaveLength(14);

    expect(results[0].trip_id).toEqual('39u');
  });

  it('should return array of stoptimes for a given date, end_time and stop_id', () => {
    const date = 20160704;

    const results = getStoptimes(
      {
        date,
        stop_id: '777403',
        end_time: '09:30:00',
      },
      [],
      [['arrival_timestamp', 'ASC']],
    );

    expect(results).toHaveLength(2);

    expect(results[0].trip_id).toEqual('23u');
  });

  it('should return array of stoptimes for a given date, start_time, end_time and stop_id', () => {
    const date = 20160704;

    const results = getStoptimes(
      {
        date,
        stop_id: '777403',
        start_time: '17:30:00',
        end_time: '18:30:00',
      },
      [],
      [['arrival_timestamp', 'ASC']],
    );

    expect(results).toHaveLength(2);

    expect(results[0].trip_id).toEqual('43u');
  });

  it('should return generated timestamp columns', () => {
    const date = 20160704;

    const results = getStoptimes(
      {
        date,
        stop_id: '777403',
        start_time: '17:30:00',
        end_time: '18:30:00',
      },
      [],
      [['arrival_timestamp', 'ASC']],
    );

    expect(results).toHaveLength(2);

    expect(results[0].arrival_timestamp).toEqual(63180);
    expect(results[0].departure_timestamp).toEqual(63180);
    expect(results[1].arrival_timestamp).toEqual(65400);
    expect(results[1].departure_timestamp).toEqual(65400);
  });
});
