import { describe, it, beforeAll, afterAll, expect } from './test-utils.ts';
import config from './test-config.ts';
import {
  openDb,
  closeDb,
  importGtfs,
  getRunsPieces,
} from '../../dist/index.js';

beforeAll(async () => {
  openDb();
  await importGtfs(config);
});

afterAll(async () => {
  const db = openDb();
  closeDb(db);
});

describe('getRunsPieces():', () => {
  it('should return empty array if no runs pieces (TODS)', () => {
    const pieceId = 'fake-piece-id';

    const results = getRunsPieces({
      piece_id: pieceId,
    });

    expect(results).toHaveLength(0);
  });
});
