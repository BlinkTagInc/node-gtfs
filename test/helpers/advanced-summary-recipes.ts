import { sql, type Expression, type Kysely } from 'kysely';
import type { GtfsDatabase } from '../../src/schema/index.ts';
import type { GtfsDatabaseDialect } from '../../src/kysely.ts';

// Application-side recipes, deliberately not another public aggregate API.
export function integerText(
  expression: Expression<unknown>,
  dialect: GtfsDatabaseDialect,
) {
  return sql<
    string | null
  >`cast(${expression} as ${sql.raw(dialect === 'mysql' ? 'char' : 'text')})`;
}

export function safeInteger(value: unknown): number {
  if (
    (typeof value !== 'number' &&
      typeof value !== 'bigint' &&
      typeof value !== 'string') ||
    (typeof value === 'string' && !/^-?\d+$/.test(value))
  ) {
    throw new TypeError('Expected an integer result');
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError('Integer result is outside the safe range');
  }
  return result;
}

export function nullableNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    throw new TypeError('Expected a numeric result');
  }
  const result = Number(value);
  if (!Number.isFinite(result)) {
    throw new RangeError('Numeric result must be finite');
  }
  return result;
}

export function serviceTime(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  const seconds = safeInteger(value);
  if (seconds < 0) {
    throw new RangeError('Service time must be non-negative');
  }
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export function rankedTrips(
  database: Kysely<GtfsDatabase>,
  sourceIds: readonly string[],
) {
  return database
    .selectFrom('trips')
    .select(['source_id', 'route_id', 'trip_id', 'service_id', 'direction_id'])
    .select((eb) =>
      eb.fn
        .agg<number>('row_number', [])
        .over((window) =>
          window
            .partitionBy(['source_id', 'route_id'])
            .orderBy('trip_id', 'desc'),
        )
        .as('position'),
    )
    .where((eb) =>
      sourceIds.length === 0 ? eb.or([]) : eb('source_id', 'in', sourceIds),
    );
}

export function representativeTrips(
  database: Kysely<GtfsDatabase>,
  sourceIds: readonly string[],
) {
  return database
    .selectFrom(rankedTrips(database, sourceIds).as('ranked'))
    .where('position', '=', 1);
}
