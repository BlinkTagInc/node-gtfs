import type {
  RunPiece,
  QueryOptions,
  SqlOrderBy,
  SqlWhere,
} from '../../types/global_interfaces.ts';
import { runsPieces } from '../../schema/tables/tods/runs-pieces.ts';
import { findRows } from '../find-rows.ts';

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
