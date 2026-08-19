import { describe, it, expect, withGtfsFixture } from './test-utils.ts';
import { openDb } from '../../dist/index.js';

withGtfsFixture();

describe('Raw Query:', () => {
  it('should DELETE a trip', () => {
    const db = openDb();

    const results = db.prepare('SELECT COUNT(*) FROM trips').get() as {
      'COUNT(*)': number;
    };

    expect(results['COUNT(*)']).toEqual(218);

    db.exec("DELETE FROM trips where trip_id = '329';");

    const newResults = db.prepare('SELECT COUNT(*) FROM trips').get() as {
      'COUNT(*)': number;
    };

    expect(newResults['COUNT(*)']).toEqual(217);
  });
});
