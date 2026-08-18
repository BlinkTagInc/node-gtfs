import type { Translation } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { translations } from '../../schema/tables/gtfs-schedule/translations.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all translations that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getTranslations<Fields extends keyof Translation>(
  query: RowQuery<Translation> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<Translation> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<Translation, Fields>(
    translations,
    query,
    fields,
    orderBy,
    options,
  );
}
