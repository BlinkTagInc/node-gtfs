import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getOperators } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getOperators():', () => {
  it('should return empty array if no operators (TIDES)', () => {
    const operatorId = 'fake-operator-id';

    const results = getOperators({
      operator_id: operatorId,
    });

    expect(results).toHaveLength(0);
  });
});
