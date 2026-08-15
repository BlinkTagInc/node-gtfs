import type {
  BoardAlight,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { boardAlight } from '../../models/gtfs-ride/board-alight.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all board-alights that match the query parameters.
 */
export function getBoardAlights<Fields extends keyof BoardAlight>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<BoardAlight, Fields>(
    boardAlight,
    query,
    fields,
    orderBy,
    options,
  );
}
