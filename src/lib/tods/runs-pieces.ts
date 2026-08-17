import type { RunPiece } from '../../schema/row-types.ts';
import type {
  RowOrderBy,
  RowQuery,
  SqliteQueryOptions,
} from '../../types/query.ts';
import { runsPieces } from '../../schema/tables/tods/runs-pieces.ts';
import { findRows } from '../find-rows.ts';

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
