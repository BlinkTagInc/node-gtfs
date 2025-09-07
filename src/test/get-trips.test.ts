import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import { closeDb, getTrips, importGtfs, openDb } from '../../dist/index.js';
import config from './test-config.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTrips():', () => {
  it('should return empty array if no trips exist', () => {
    const tripId = 'fake-trip-id';

    const results = getTrips({
      trip_id: tripId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return expected trips', () => {
    const routeId = 'Bu-16APR';

    const results = getTrips({
      route_id: routeId,
    });

    const expectedResult = {
      trip_id: '329',
      route_id: 'Bu-16APR',
      service_id: 'CT-16APR-Caltrain-Weekday-01',
      trip_headsign: 'SAN FRANCISCO STATION',
      trip_short_name: '329',
      direction_id: 0,
      block_id: null,
      shape_id: 'cal_tam_sf',
      wheelchair_accessible: 1,
      bikes_allowed: 1,
      cars_allowed: null,
    };

    expect(results).toHaveLength(30);
    expect(results).toContainEqual(expectedResult);
  });

  it('should return trips filtered by date', () => {
    // 2017-04-16 is a Sunday
    const sunday = 20170416;
    const routeId = 'Bu-16APR';

    const sundayResults = getTrips({
      date: sunday,
      route_id: routeId,
    });

    expect(sundayResults.length).toBe(4);
    const weekdayResult = {
      trip_id: '329',
      route_id: 'Bu-16APR',
      service_id: 'CT-16APR-Caltrain-Weekday-01',
      trip_headsign: 'SAN FRANCISCO STATION',
      trip_short_name: '329',
      direction_id: 0,
      block_id: null,
      shape_id: 'cal_tam_sf',
      wheelchair_accessible: 1,
      bikes_allowed: 1,
      cars_allowed: null,
    };

    expect(sundayResults).toNotContainEqual(weekdayResult);
  });
});
