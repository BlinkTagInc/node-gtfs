import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getTranslations,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getTranslations():', () => {
  it('should return empty array if no translations', () => {
    const fieldName = 'fake-field-name';

    const results = getTranslations({
      field_name: fieldName,
    });

    expect(results).toHaveLength(0);
  });
});
