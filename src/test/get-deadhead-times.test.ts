import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getDeadheadTimes,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getDeadheadTimes():', () => {
  it('should return empty array if no deadhead times (TODS)', () => {
    const deadheadId = 'fake-deadhead-id';

    const results = getDeadheadTimes({
      deadhead_id: deadheadId,
    });

    expect(results).toHaveLength(0);
  });
});
