import { sql, type RawBuilder, type SelectQueryBuilder } from 'kysely';

import type { CompiledGtfsTable } from '../../../schema/compile-table.ts';
import { assertDefinedWhereValues } from '../../../query/where-validation.ts';
import type { GtfsDatabaseDialect } from '../../dialects.ts';
import { getServiceDaySecondsFieldName } from '../../../schema/compile-table.ts';
import { createGtfsQueryError } from '../../../diagnostics/errors.ts';
import {
  getFilterCurrencyScope,
  normalizeQueryFilterValue,
} from './filter-values.ts';
import { getPortableQueryFields, resolvePortableQueryField } from './plan.ts';
import type {
  PortableFindManyOptions,
  PortableReadContext,
  PortableQueryField,
} from './types.ts';

interface FieldFilterContext {
  readonly dialect: GtfsDatabaseDialect;
  readonly tableName: string;
  readonly field: PortableQueryField;
  readonly qualifier?: string;
  readonly currencyWhere: Readonly<Record<string, unknown>>;
  readonly requiredColumns?: Map<string, Set<string>>;
}

function compilePortableFieldFilter(
  context: FieldFilterContext,
  value: unknown,
): RawBuilder<boolean> {
  const { field, tableName, qualifier, requiredColumns } = context;
  if (
    (value !== null && typeof value === 'object') ||
    typeof value === 'function'
  ) {
    throw createGtfsQueryError('Field filters support scalar equality only', {
      table: tableName,
      field: field.publicName,
      value,
    });
  }
  const storageName =
    value !== null && field.column?.valueKind === 'time'
      ? getServiceDaySecondsFieldName(field.publicName)
      : field.storageName;
  if (storageName !== field.storageName && requiredColumns !== undefined) {
    const columns = requiredColumns.get(tableName) ?? new Set<string>();
    columns.add(storageName);
    requiredColumns.set(tableName, columns);
  }
  const reference = sql.ref(
    qualifier === undefined ? storageName : `${qualifier}.${storageName}`,
  );
  return value === null
    ? sql<boolean>`${reference} is null`
    : sql<boolean>`${reference} = ${normalizeQueryFilterValue({ ...context, value })}`;
}

export function compilePortableWhereExpressions({
  dialect,
  table,
  where,
  qualifier,
  requiredColumns,
  currencyWhere = {},
}: {
  readonly dialect: GtfsDatabaseDialect;
  readonly table: CompiledGtfsTable;
  readonly where: NonNullable<PortableFindManyOptions['where']>;
  readonly qualifier?: string;
  readonly requiredColumns?: Map<string, Set<string>>;
  readonly currencyWhere?: Readonly<Record<string, unknown>>;
}): RawBuilder<boolean>[] {
  assertDefinedWhereValues(where, table.tableName);
  const fields = getPortableQueryFields(table);
  const currencies = { ...currencyWhere, ...getFilterCurrencyScope(where) };
  return Object.entries(where).map(([fieldName, value]) =>
    compilePortableFieldFilter(
      {
        dialect,
        tableName: table.tableName,
        field: resolvePortableQueryField(fields, table.tableName, fieldName),
        currencyWhere: currencies,
        ...(qualifier === undefined ? {} : { qualifier }),
        ...(requiredColumns === undefined ? {} : { requiredColumns }),
      },
      value,
    ),
  );
}

export function compilePortableQueryPredicates<DB>({
  context,
  where,
}: {
  context: PortableReadContext<DB>;
  where: PortableFindManyOptions['where'];
}): readonly RawBuilder<boolean>[] {
  return [
    ...(context.sourceIds === null
      ? []
      : [
          context.sourceIds.length === 0
            ? sql<boolean>`1 = 0`
            : sql<boolean>`${sql.ref(`${context.table.tableName}.source_id`)} in (${sql.join(context.sourceIds)})`,
        ]),
    ...compilePortableWhereExpressions({
      dialect: context.dialect,
      table: context.table,
      where: where ?? {},
    }),
    ...(context.additionalWhere ?? []),
  ];
}

export function applyPortableQueryPredicates<DB, TB extends keyof DB, Output>(
  query: SelectQueryBuilder<DB, TB, Output>,
  expressions: readonly RawBuilder<boolean>[],
): SelectQueryBuilder<DB, TB, Output> {
  let filtered = query;
  for (const expression of expressions) {
    filtered = filtered.where(expression);
  }
  return filtered;
}
