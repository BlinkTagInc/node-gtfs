import { type RawBuilder, sql } from 'kysely';

import { joinFilterConditions } from './filter-context.ts';

export function compileNullSafeKeyMembership({
  columns,
  from,
  where,
}: {
  readonly columns: readonly {
    readonly source: RawBuilder<unknown>;
    readonly target: RawBuilder<unknown>;
  }[];
  readonly from: RawBuilder<unknown>;
  readonly where: RawBuilder<boolean>;
}): RawBuilder<boolean> {
  const sourceFields = columns.map(({ source }) => source);
  const targetFields = columns.map(({ target }) => target);
  // Keep IN indexable while giving it EXISTS's two-valued NULL semantics,
  // including when the complete membership predicate is later negated.
  return joinFilterConditions([
    ...sourceFields.map((field) => sql<boolean>`${field} is not null`),
    sql<boolean>`(${sql.join(sourceFields)}) in (
      select ${sql.join(targetFields)} from ${from}
      where ${joinFilterConditions([
        ...targetFields.map((field) => sql<boolean>`${field} is not null`),
        where,
      ])}
    )`,
  ]);
}
