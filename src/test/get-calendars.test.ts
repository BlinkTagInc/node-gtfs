import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getCalendars } from '../index.ts';

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
