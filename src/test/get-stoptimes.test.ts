import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getStoptimes } from '../index.ts';

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
});
