import type { Database as SqliteDatabase } from 'better-sqlite3';

export type QueryScalar = string | number | bigint | boolean | null | undefined;

export type DynamicQuery = Record<string, QueryScalar | readonly QueryScalar[]>;

type RowQueryScalar<Value> = Extract<Value, QueryScalar> | null | undefined;

export type RowQuery<Row extends object> = Partial<{
  [Field in Extract<keyof Row, string>]:
    RowQueryScalar<Row[Field]> | readonly RowQueryScalar<Row[Field]>[];
}>;

export type SortDirection = 'ASC' | 'DESC';

export type RowOrderBy<Row extends object> = readonly (readonly [
  Extract<keyof Row, string>,
  SortDirection,
])[];

export type SelectedRow<Row extends object, Fields extends keyof Row> = [
  Fields,
] extends [never]
  ? Row
  : Pick<Row, Fields>;

export interface SqliteQueryOptions {
  db?: SqliteDatabase;
}

export interface StopQueryOptions extends SqliteQueryOptions {
  bounding_box_side_m?: number;
}

export type AdvancedQueryJoinType = 'INNER' | 'LEFT' | 'LEFT OUTER' | 'CROSS';

export interface AdvancedQueryJoin {
  type?: AdvancedQueryJoinType;
  table: string;
  /** Raw SQL join expression. Identifiers and values are not escaped. */
  on: string;
}

export interface AdvancedQueryOptions {
  db?: SqliteDatabase;
  query?: DynamicQuery;
  fields?: readonly string[];
  orderBy?: readonly (readonly [string, SortDirection])[];
  join?: readonly AdvancedQueryJoin[];
}

export type DatabaseResultValue = string | number | bigint | Uint8Array | null;

export type DynamicQueryResult = Record<string, DatabaseResultValue>;
