import type { Translation } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { translations } from '../../schema/tables/gtfs-schedule/translations.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all translations that match the query parameters.
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
