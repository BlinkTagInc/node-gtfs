import { describe, expect, it } from './test-utils.ts';
import { getDatabaseErrorContext } from '../lib/database-error-context.ts';
import { getGtfsDialectCapabilities } from '../lib/database-dialects.ts';

describe('database portability internals', () => {
  it('centralizes dialect-specific limits and strategies', () => {
    expect(getGtfsDialectCapabilities('postgres')).toEqual({
      dialect: 'postgres',
      maximumIdentifierLength: 63,
      maximumParametersPerInsert: 60_000,
      maximumRowsPerInsert: 1_000,
      primaryKeyStrategy: 'native',
      duplicateStrategy: 'conflict',
    });
    expect(getGtfsDialectCapabilities('mysql').textIndexPrefixLength).toBe(191);
    expect(getGtfsDialectCapabilities('sqlite').duplicateStrategy).toBe(
      'ignore',
    );
  });

  it('normalizes driver context without retaining SQL text', () => {
    const details = getDatabaseErrorContext({
      code: '23505',
      constraint: 'unique_agency',
      table: 'agency',
      sql: 'INSERT INTO agency ...',
    });

    expect(details).toEqual({
      databaseCode: '23505',
      databaseConstraint: 'unique_agency',
      databaseTable: 'agency',
    });
  });
});
