import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getCalendars,
  getServiceIdsByDate,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getCalendars():', () => {
  it('should return empty array if no calendars', () => {
    const serviceId = 'fake-service-id';

    const results = getCalendars({
      service_id: serviceId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return expected calendars by day', () => {
    const results = getCalendars({
      sunday: 1,
    });

    const expectedResult = {
      service_id: 'CT-16APR-Caltrain-Sunday-02',
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 1,
      start_date: 20140323,
      end_date: 20190331,
    };

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expectedResult);
  });

  it('should return expected calendars by array of service_ids', () => {
    const results = getCalendars({
      service_id: [
        'CT-16APR-Caltrain-Saturday-02',
        'CT-16APR-Caltrain-Sunday-02',
      ],
    });

    const expectedResult = [
      {
        service_id: 'CT-16APR-Caltrain-Saturday-02',
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 1,
        sunday: 0,
        start_date: 20140329,
        end_date: 20190331,
      },
      {
        service_id: 'CT-16APR-Caltrain-Sunday-02',
        monday: 0,
        tuesday: 0,
        wednesday: 0,
        thursday: 0,
        friday: 0,
        saturday: 0,
        sunday: 1,
        start_date: 20140323,
        end_date: 20190331,
      },
    ];

    expect(results).toHaveLength(2);
    expect(results).toEqual(expectedResult);
  });
});

describe('getServiceIdsByDate():', () => {
  it('should return correct service_ids for a given date', () => {
    const testDate = 20160413;
    const results = getServiceIdsByDate(testDate);

    const expectedServiceIds = ['CT-16APR-Caltrain-Weekday-01'];

    expect(results).toHaveLength(expectedServiceIds.length);
    expect(results.sort()).toEqual(expectedServiceIds.sort());
  });

  it('should throw an error if date is not provided', () => {
    expect(() => {
      getServiceIdsByDate();
    }).toThrow('`date` is a required query parameter');
  });

  it('should handle exception types correctly', () => {
    const testDate = 20160704;
    const results = getServiceIdsByDate(testDate);

    const expectedServiceIds = ['CT-16APR-Caltrain-Sunday-02'];

    expect(results).toHaveLength(expectedServiceIds.length);
    expect(results.sort()).toEqual(expectedServiceIds.sort());

    // Verify that excluded service_ids are not present
    const excludedServiceId = 'CT-16APR-Caltrain-Weekday-01'; // Assuming this is excluded via exception_type 1
    expect(results).toNotContain(excludedServiceId);
  });
});
