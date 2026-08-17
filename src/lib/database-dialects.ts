export type GtfsDatabaseDialect = 'mysql' | 'postgres' | 'sqlite';

export interface GtfsDialectCapabilities {
  dialect: GtfsDatabaseDialect;
  maximumIdentifierLength: number;
  maximumParametersPerInsert: number;
  maximumRowsPerInsert: number;
  textIndexPrefixLength?: number;
  primaryKeyStrategy: 'native' | 'hash';
  duplicateStrategy: 'conflict' | 'duplicate-key' | 'ignore';
}

const DIALECT_CAPABILITIES: Record<
  GtfsDatabaseDialect,
  GtfsDialectCapabilities
> = {
  sqlite: {
    dialect: 'sqlite',
    maximumIdentifierLength: 63,
    maximumParametersPerInsert: 32_000,
    maximumRowsPerInsert: 1_000,
    primaryKeyStrategy: 'native',
    duplicateStrategy: 'ignore',
  },
  postgres: {
    dialect: 'postgres',
    maximumIdentifierLength: 63,
    maximumParametersPerInsert: 60_000,
    maximumRowsPerInsert: 1_000,
    primaryKeyStrategy: 'native',
    duplicateStrategy: 'conflict',
  },
  mysql: {
    dialect: 'mysql',
    maximumIdentifierLength: 64,
    maximumParametersPerInsert: 60_000,
    maximumRowsPerInsert: 1_000,
    textIndexPrefixLength: 191,
    primaryKeyStrategy: 'hash',
    duplicateStrategy: 'duplicate-key',
  },
};

export function getGtfsDialectCapabilities(
  dialect: GtfsDatabaseDialect,
): GtfsDialectCapabilities {
  return DIALECT_CAPABILITIES[dialect];
}
