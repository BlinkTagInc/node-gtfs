import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getDatabaseErrorContext } from '../../src/database/error-context.ts';
import { getGtfsDialectCapabilities } from '../../src/database/dialects.ts';

describe('database portability internals', () => {
  it('centralizes dialect-specific limits and strategies', () => {
    assert.deepEqual(getGtfsDialectCapabilities('postgres'), {
      dialect: 'postgres',
      maximumIdentifierLength: 63,
      maximumParametersPerInsert: 60_000,
      maximumRowsPerInsert: 1_000,
      primaryKeyStrategy: 'native',
      binaryTextCollation: 'C',
    });
    assert.equal(
      getGtfsDialectCapabilities('mysql').textIndexPrefixLength,
      191,
    );
    assert.equal(
      getGtfsDialectCapabilities('sqlite').maximumParametersPerInsert,
      32_000,
    );
  });

  it('normalizes driver context without retaining SQL text', () => {
    const details = getDatabaseErrorContext({
      code: '23505',
      constraint: 'unique_agency',
      table: 'agency',
      sql: 'INSERT INTO agency ...',
    });

    assert.deepEqual(details, {
      databaseCode: '23505',
      databaseConstraint: 'unique_agency',
      databaseTable: 'agency',
    });
  });
});
