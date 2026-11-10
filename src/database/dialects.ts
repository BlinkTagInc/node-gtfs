import { createHash } from 'node:crypto';

export type GtfsDatabaseDialect = 'mysql' | 'postgres' | 'sqlite';

interface GtfsDialectCapabilities {
  readonly dialect: GtfsDatabaseDialect;
  readonly maximumIdentifierLength: number;
  readonly maximumParametersPerInsert: number;
  readonly maximumRowsPerInsert: number;
  readonly textIndexPrefixLength?: number;
  readonly primaryKeyStrategy: 'native' | 'hash';
  readonly binaryTextCollation: 'BINARY' | 'C' | 'utf8mb4_0900_bin';
}

const DIALECT_CAPABILITIES: Readonly<
  Record<GtfsDatabaseDialect, GtfsDialectCapabilities>
> = Object.freeze({
  sqlite: Object.freeze({
    dialect: 'sqlite',
    maximumIdentifierLength: 63,
    maximumParametersPerInsert: 32_000,
    maximumRowsPerInsert: 1_000,
    primaryKeyStrategy: 'native',
    binaryTextCollation: 'BINARY',
  }),
  postgres: Object.freeze({
    dialect: 'postgres',
    maximumIdentifierLength: 63,
    maximumParametersPerInsert: 60_000,
    maximumRowsPerInsert: 1_000,
    primaryKeyStrategy: 'native',
    binaryTextCollation: 'C',
  }),
  mysql: Object.freeze({
    dialect: 'mysql',
    maximumIdentifierLength: 64,
    maximumParametersPerInsert: 60_000,
    maximumRowsPerInsert: 1_000,
    textIndexPrefixLength: 191,
    primaryKeyStrategy: 'hash',
    binaryTextCollation: 'utf8mb4_0900_bin',
  }),
});

export function getGtfsDialectCapabilities(
  dialect: GtfsDatabaseDialect,
): GtfsDialectCapabilities {
  return DIALECT_CAPABILITIES[dialect];
}

export function shortenDatabaseIdentifier(
  identifier: string,
  dialect: GtfsDatabaseDialect,
): string {
  const maximumLength =
    getGtfsDialectCapabilities(dialect).maximumIdentifierLength;
  if (identifier.length <= maximumLength) {
    return identifier;
  }

  const hash = createHash('sha256')
    .update(identifier)
    .digest('hex')
    .slice(0, 8);
  return `${identifier.slice(0, maximumLength - hash.length - 1)}_${hash}`;
}
