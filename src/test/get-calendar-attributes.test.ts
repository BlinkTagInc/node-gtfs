import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getCalendarAttributes,
} from '../../dist/index.js';

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
