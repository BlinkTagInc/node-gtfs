/** A value accepted by better-sqlite3 as a statement parameter. */
export type SqliteBindValue = null | string | number | bigint | Uint8Array;

/** SQL text paired with values ordered for its `?` placeholders. */
export interface SqlClause {
  clause: string;
  params: SqliteBindValue[];
}
