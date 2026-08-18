import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import { openDb, closeDb, importGtfs, getDeadheads } from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getDeadheads():', () => {
  it('should return empty array if no deadheads (TODS)', () => {
    const deadheadId = 'fake-deadhead-id';

    const results = getDeadheads({
      deadhead_id: deadheadId,
    });

    expect(results).toHaveLength(0);
  });
});
