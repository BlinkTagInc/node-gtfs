import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getTranslations } from '../index.ts';

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
