import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getCalendarAttributes,
} from '../index.ts';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getCalendarAttributes():', () => {
  it('should return empty array if no calendar attributes', () => {
    const serviceId = 'fake-service-id';

    const results = getCalendarAttributes({
      service_id: serviceId,
    });

    expect(results).toHaveLength(0);
  });
});
