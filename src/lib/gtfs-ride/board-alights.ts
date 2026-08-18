import type { BoardAlight } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { boardAlight } from '../../schema/tables/gtfs-ride/board-alight.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all board-alights that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getBoardAlights<Fields extends keyof BoardAlight>(
  query: RowQuery<BoardAlight> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<BoardAlight> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<BoardAlight, Fields>(
    boardAlight,
    query,
    fields,
    orderBy,
    options,
  );
}
