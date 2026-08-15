import type {
  Translation,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { translations } from '../../models/gtfs/translations.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all translations that match the query parameters.
 */
export function getTranslations<Fields extends keyof Translation>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<Translation, Fields>(
    translations,
    query,
    fields,
    orderBy,
    options,
  );
}
