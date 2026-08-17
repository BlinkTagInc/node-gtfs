import type { BoardAlight } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { boardAlight } from '../../schema/tables/gtfs-ride/board-alight.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all board-alights that match the query parameters.
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
