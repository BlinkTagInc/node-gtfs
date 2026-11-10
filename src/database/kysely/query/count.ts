import { sql } from 'kysely';
import { asDynamicKysely } from '../../clients.ts';
import { createGtfsQueryError } from '../../../diagnostics/errors.ts';
import { createPortableReadQuery } from './execute.ts';
import type { PortableFindManyOptions, PortableReadContext } from './types.ts';

/** Count the paginated input, independent of the public projection. */
export async function executePortableCount<DB>(
  context: PortableReadContext<DB>,
  options: PortableFindManyOptions,
): Promise<number> {
  const input = createPortableReadQuery(context, options)
    .select(sql<number>`1`.as('_row'))
    .as('_count_input');
  const row = await asDynamicKysely(context.database)
    .selectFrom(input)
    .select(
      sql<string>`cast(count(*) as ${sql.raw(context.dialect === 'mysql' ? 'char' : 'text')})`.as(
        'total',
      ),
    )
    .executeTakeFirstOrThrow();
  const total = Number(row.total);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw createGtfsQueryError('Count is outside the supported numeric range', {
      table: context.table.tableName,
      value: row.total,
    });
  }
  return total;
}
