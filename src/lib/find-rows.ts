import type {
  RowOrderBy,
  RowQuery,
  SelectedRow,
  SqliteQueryOptions,
} from '../types/query.ts';
import type { GtfsTableDefinition } from '../schema/define-table.ts';
import { executeSqliteRead } from './read-spec.ts';

export function findRows<
  Row extends object,
  Fields extends Extract<keyof Row, string>,
>(
  definition: GtfsTableDefinition,
  query: RowQuery<Row>,
  fields: readonly Fields[],
  orderBy: RowOrderBy<Row>,
  options: SqliteQueryOptions,
): SelectedRow<Row, Fields>[] {
  return executeSqliteRead<Row, Fields>(
    definition,
    { where: query, select: fields, orderBy },
    options,
  );
}
