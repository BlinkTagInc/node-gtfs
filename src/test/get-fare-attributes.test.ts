import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getFareAttributes,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getFareAttributes():', () => {
  it('should return empty array if no fare_attributes', () => {
    const fareId = 'not_real';

    const results = getFareAttributes({
      fare_id: fareId,
    });

    expect(results).toHaveLength(0);
  });

  it('should return expected fare_attributes', () => {
    const fareId = 'OW_1_20160228';

    const results = getFareAttributes({
      fare_id: fareId,
    });

    const expectedResult = {
      fare_id: 'OW_1_20160228',
      price: 3.75,
      currency_type: 'USD',
      payment_method: 1,
      transfers: 0,
      agency_id: null,
      transfer_duration: null,
    };

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expectedResult);
  });
});
