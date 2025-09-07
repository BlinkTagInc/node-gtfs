import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getCalendarDates,
} from '../../dist/index.js';
import { sortBy } from 'lodash-es';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getCalendarDates():', () => {
  it('should return empty array if no calendar dates exist', () => {
    const serviceId = 'fake-service-id';

    const results = getCalendarDates({
      service_id: serviceId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return expected calendar dates', () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = getCalendarDates({
      service_id: serviceId,
    });

    const expectedResult = [
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124,
        exception_type: 2,
        holiday_name: null,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905,
        exception_type: 2,
        holiday_name: null,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704,
        exception_type: 2,
        holiday_name: null,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530,
        exception_type: 2,
        holiday_name: null,
      },
    ];

    expect(results).toHaveLength(4);
    expect(results).toEqual(sortBy(expectedResult, 'date'));
  });

  it('should return only specific keys for expected calendar dates, sorted by date', () => {
    const serviceId = 'CT-16APR-Caltrain-Weekday-01';

    const results = getCalendarDates(
      {
        service_id: serviceId,
      },
      ['service_id', 'date'],
      [
        ['date', 'ASC'],
        ['service_id', 'ASC'],
      ],
    );

    const expectedResult = [
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160530,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160704,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20160905,
      },
      {
        service_id: 'CT-16APR-Caltrain-Weekday-01',
        date: 20161124,
      },
    ];

    expect(results).toHaveLength(4);
    expect(results).toEqual(expectedResult);
  });
});
