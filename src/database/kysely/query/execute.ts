import { sql } from 'kysely';

import { asDynamicKysely } from '../../clients.ts';
import {
  createGtfsQueryError,
  GtfsError,
  GtfsErrorCode,
  isGtfsError,
} from '../../../diagnostics/errors.ts';
import { compilePortableQueryPlan, getComparisonStorageName } from './plan.ts';
import {
  applyPortableQueryPredicates,
  compilePortableQueryPredicates,
} from './predicates.ts';
import { minorUnitsToDecimalString } from '../../../values/money.ts';
import { compilePortableQuerySelection } from './selection.ts';
import type {
  PortableFindManyOptions,
  PortableReadContext,
  PortableQueryField,
} from './types.ts';

export type {
  PortableFindManyOptions,
  PortableQueryOrderBy,
  PortableReadContext,
} from './types.ts';

function materializePortableQueryRow(
  storageRow: Readonly<Record<string, unknown>>,
  selectedFields: readonly PortableQueryField[],
  hiddenCurrencies: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const row = { ...storageRow };
  for (const field of selectedFields) {
    if (!field.column?.monetary || row[field.publicName] === null) {
      continue;
    }
    const currencyField = field.column.monetary.currencyField;
    const hiddenCurrency = hiddenCurrencies.get(currencyField);
    const currency =
      row[currencyField] ??
      (hiddenCurrency === undefined ? undefined : row[hiddenCurrency]);
    row[field.publicName] = minorUnitsToDecimalString(
      row[field.publicName] as string,
      currency,
    );
  }
  for (const alias of hiddenCurrencies.values()) {
    delete row[alias];
  }
  return row;
}

/** Returns materialized rows, not a Kysely builder. */
export async function executePortableFindMany<DB>(
  context: PortableReadContext<DB>,
  options: PortableFindManyOptions = {},
): Promise<Record<string, unknown>[]> {
  const plan = compilePortableQueryPlan(context.table, options);
  const selection = compilePortableQuerySelection(
    context.dialect,
    plan.selectedFields,
  );
  const query = createPortableReadQuery(context, options).select(
    selection.expressions,
  );
  const rows = (await query.execute()) as Record<string, unknown>[];
  return rows.map((row) =>
    materializePortableQueryRow(
      row,
      plan.selectedFields,
      selection.hiddenCurrencies,
    ),
  );
}

export async function* streamPortableQueryRows<DB>(
  context: PortableReadContext<DB>,
  options: PortableFindManyOptions = {},
): AsyncIterableIterator<Record<string, unknown>> {
  const plan = compilePortableQueryPlan(context.table, options);
  const selection = compilePortableQuerySelection(
    context.dialect,
    plan.selectedFields,
  );
  const query = createPortableReadQuery(context, options).select(
    selection.expressions,
  );
  try {
    for await (const row of query.stream(1000)) {
      yield materializePortableQueryRow(
        row,
        plan.selectedFields,
        selection.hiddenCurrencies,
      );
    }
  } catch (cause: unknown) {
    if (isGtfsError(cause)) {
      throw cause;
    }
    if (
      context.dialect === 'postgres' &&
      cause instanceof Error &&
      cause.message.includes('`cursor` is not present')
    ) {
      throw createGtfsQueryError(
        'PostgreSQL streaming requires pg-cursor in the Kysely PostgresDialect configuration',
        {
          table: context.table.tableName,
          reason: 'STREAMING_NOT_CONFIGURED',
          dialect: context.dialect,
        },
      );
    }
    throw new GtfsError('Could not stream query results', {
      code: GtfsErrorCode.DATABASE_OPERATION_FAILED,
      details: { table: context.table.tableName, dialect: context.dialect },
      cause,
    });
  }
}

export function createPortableReadQuery<DB>(
  context: PortableReadContext<DB>,
  options: PortableFindManyOptions = {},
) {
  const plan = compilePortableQueryPlan(context.table, options);
  const predicates = compilePortableQueryPredicates({
    context,
    where: options.where,
  });
  const database = asDynamicKysely(context.database);
  let query = applyPortableQueryPredicates(
    database.selectFrom(context.table.tableName),
    predicates,
  );

  for (const order of plan.orderBy) {
    query = query.orderBy(
      sql.ref(getComparisonStorageName(order.field)),
      order.direction,
    );
  }
  if (plan.limit !== undefined) {
    query = query.limit(plan.limit);
  } else if (plan.offset !== undefined && context.dialect !== 'postgres') {
    query = query.limit(
      sql.raw<number>(
        context.dialect === 'sqlite' ? '-1' : '18446744073709551615',
      ),
    );
  }
  if (plan.offset !== undefined) {
    query = query.offset(plan.offset);
  }

  return query;
}
