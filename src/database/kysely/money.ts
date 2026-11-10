import { sql, type RawBuilder } from 'kysely';

import type { GtfsDatabaseDialect } from '../dialects.ts';

export function castMonetaryStorageToText(
  dialect: GtfsDatabaseDialect,
  columnName: string,
): RawBuilder<unknown> {
  const castType = dialect === 'mysql' ? 'char' : 'text';
  return sql`cast(${sql.ref(columnName)} as ${sql.raw(castType)})`;
}
