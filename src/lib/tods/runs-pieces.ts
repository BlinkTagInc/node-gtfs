import type { RunPiece } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { runsPieces } from '../../schema/tables/tods/runs-pieces.ts';
import { findRows } from '../sqlite-query.ts';

/**
 * Returns an array of all run pieces that match the query parameters.
 * @param query Column values to match, as single values or arrays
 * @param fields Columns to select, or every column when empty
 * @param orderBy Column and direction pairs to sort by
 * @param options Query options, including the database to read from
 * @returns Matching rows, containing only `fields` when it is not empty
 */
export function getRunsPieces<Fields extends keyof RunPiece>(
  query: RowQuery<RunPiece> = {},
  fields: readonly Fields[] = [],
  orderBy: RowOrderBy<RunPiece> = [],
  options: SqliteQueryOptions = {},
) {
  return findRows<RunPiece, Fields>(
    runsPieces,
    query,
    fields,
    orderBy,
    options,
  );
}
