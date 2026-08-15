import type {
  RunPiece,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { runsPieces } from '../../models/ods/runs-pieces.ts';
import { findRows } from '../find-rows.ts';

/*
 * Returns an array of all runs_pieces that match the query parameters.
 */
export function getRunsPieces<Fields extends keyof RunPiece>(
  query: SqlWhere = {},
  fields: Fields[] = [],
  orderBy: SqlOrderBy = [],
  options: QueryOptions = {},
) {
  return findRows<RunPiece, Fields>(
    runsPieces,
    query,
    fields,
    orderBy,
    options,
  );
}
