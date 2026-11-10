import type { Kysely, RawBuilder } from 'kysely';
import type { GtfsReader } from '../types/domain-query.ts';
import { isPlainObject } from '../config/options.ts';
import { executePortableCount } from '../database/kysely/query/count.ts';
import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type { GtfsRepository } from '../types/repository.ts';
import type { GtfsDatabaseDialect } from '../database/dialects.ts';
import type {
  PortableFindManyOptions,
  PortableQueryOrderBy,
} from '../database/kysely/query/types.ts';
import {
  compilePortableQueryPlan,
  getComparisonStorageName,
} from '../database/kysely/query/plan.ts';
import {
  executePortableFindMany,
  streamPortableQueryRows,
} from '../database/kysely/query/execute.ts';
import { validateGtfsQuerySchema } from '../database/query-schema.ts';
import {
  assertGtfsExtensionEnabled,
  type GtfsExtension,
} from '../schema/extensions.ts';
import { compileRepositoryFilters } from './filters.ts';
import { resolveQueryWhere } from './equality.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';

export type { GtfsRepository } from '../types/repository.ts';

export interface RepositoryRuntimeContext<DB> {
  databaseOperation<Result>(
    callback: (database: Kysely<DB>) => Promise<Result>,
  ): Promise<Result>;
  databaseStream<Row>(
    callback: (database: Kysely<DB>) => AsyncIterable<Row>,
  ): AsyncIterable<Row>;
  readonly dialect: GtfsDatabaseDialect;
  readonly enabledExtensions: readonly GtfsExtension[];
  readonly sourceIds: readonly string[] | null;
  readonly table: CompiledGtfsTable;
  readonly constraints?: {
    readonly where: readonly RawBuilder<boolean>[];
    readonly tables: readonly CompiledGtfsTable[];
    readonly requiredColumns?: ReadonlyMap<string, ReadonlySet<string>>;
  };
}
type QueryState = Omit<PortableFindManyOptions, 'where'> & {
  readonly filters: readonly Readonly<Record<string, unknown>>[];
};

function prepareRepositoryQuery<DB>(
  context: RepositoryRuntimeContext<DB>,
  state: QueryState,
  options: { readonly count?: boolean } = {},
) {
  const { table } = context;
  assertGtfsExtensionEnabled(
    table.tableName,
    table.specification,
    context.enabledExtensions,
  );
  const inputPlan = compilePortableQueryPlan(table, state);
  return async (database: Kysely<DB>) => {
    const filters = compileRepositoryFilters({
      dialect: context.dialect,
      table,
      filters: state.filters,
    });
    const tables = [
      table,
      ...filters.relatedTables,
      ...(context.constraints?.tables ?? []),
    ];
    for (const required of tables) {
      assertGtfsExtensionEnabled(
        required.tableName,
        required.specification,
        context.enabledExtensions,
      );
    }
    const requiredColumns = new Map(filters.requiredColumns);
    for (const [name, columns] of context.constraints?.requiredColumns ?? []) {
      requiredColumns.set(
        name,
        new Set([...(requiredColumns.get(name) ?? []), ...columns]),
      );
    }
    requiredColumns.set(
      table.tableName,
      new Set([
        ...(requiredColumns.get(table.tableName) ?? []),
        ...(!options.count
          ? inputPlan.selectedFields.map((field) => field.storageName)
          : []),
        ...inputPlan.orderBy.map((order) =>
          getComparisonStorageName(order.field),
        ),
      ]),
    );
    await validateGtfsQuerySchema({
      database,
      dialect: context.dialect,
      tables,
      requiredColumns,
    });
    const readContext = {
      database,
      dialect: context.dialect,
      table,
      sourceIds: context.sourceIds,
      additionalWhere: [
        ...filters.additionalWhere,
        ...(context.constraints?.where ?? []),
      ],
    };
    // Equality and semantic predicates are already compiled.
    const { filters: _filters, ...input } = state;
    return { readContext, input };
  };
}

export function createGtfsRepository<DB>(
  context: RepositoryRuntimeContext<DB>,
): GtfsRepository<string> {
  const { table } = context;
  const invalid = (
    message: string,
    details: Record<string, unknown> = {},
  ): never => {
    throw createGtfsQueryError(message, { table: table.tableName, ...details });
  };
  const arity = (method: string, args: readonly unknown[], count: number) => {
    if (args.length !== count) {
      invalid(
        method +
          '() requires ' +
          count +
          ' argument' +
          (count === 1 ? '' : 's'),
        { method },
      );
    }
  };
  const fieldList = (method: string, fields: readonly unknown[]) => {
    if (
      fields.length === 0 ||
      fields.some((field) => typeof field !== 'string')
    ) {
      return invalid(method + '() requires one or more field names', {
        method,
      });
    }
    compilePortableQueryPlan(table, { select: fields as string[] });
    return Object.freeze([...fields]) as readonly string[];
  };
  const execute = (state: QueryState) => {
    const prepareQuery = prepareRepositoryQuery(context, state);
    return context.databaseOperation(async (database) => {
      const { readContext, input } = await prepareQuery(database);
      return executePortableFindMany(readContext, input);
    });
  };
  const stream = (state: QueryState) => {
    const prepareQuery = prepareRepositoryQuery(context, state);
    return context.databaseStream(async function* (database) {
      const { readContext, input } = await prepareQuery(database);
      yield* streamPortableQueryRows(readContext, input);
    });
  };
  const build = (state: QueryState): object => {
    const next = (changes: Partial<QueryState>) =>
      build(Object.freeze({ ...state, ...changes }));
    const firstRow = async (method: string, args: readonly unknown[]) => {
      if (args.length > 1) {
        return invalid(`${method}() accepts at most one equality object`);
      }
      const filters =
        args.length === 0
          ? state.filters
          : [...state.filters, resolveQueryWhere(table, args[0])];
      const rows = await execute({
        ...state,
        filters,
        limit: Math.min(state.limit ?? 1, 1),
      });
      return rows[0] ?? null;
    };
    const query = {
      orderBy(...args: unknown[]) {
        arity('orderBy', args, 1);
        if (
          !Array.isArray(args[0]) ||
          Array.from(args[0]).some(
            (entry: unknown) =>
              !isPlainObject(entry) ||
              typeof entry.field !== 'string' ||
              Object.keys(entry).some(
                (key) => key !== 'field' && key !== 'direction',
              ),
          )
        ) {
          return invalid(
            'orderBy() requires an array of field and direction objects',
          );
        }
        const orderBy = Object.freeze(
          Array.from(args[0], (entry: PortableQueryOrderBy) =>
            Object.freeze({ ...entry }),
          ),
        );
        compilePortableQueryPlan(table, { orderBy });
        return next({ orderBy });
      },
      limit(...args: unknown[]) {
        arity('limit', args, 1);
        compilePortableQueryPlan(table, { limit: args[0] as number });
        if (args[0] === undefined) {
          return invalid('limit() requires a non-negative safe integer');
        }
        return next({ limit: args[0] as number });
      },
      offset(...args: unknown[]) {
        arity('offset', args, 1);
        compilePortableQueryPlan(table, { offset: args[0] as number });
        if (args[0] === undefined) {
          return invalid('offset() requires a non-negative safe integer');
        }
        return next({ offset: args[0] as number });
      },
    };
    return Object.freeze({
      ...query,
      async count(...args: unknown[]) {
        arity('count', args, 0);
        const prepareQuery = prepareRepositoryQuery(context, state, {
          count: true,
        });
        return context.databaseOperation(async (database) => {
          const { readContext, input } = await prepareQuery(database);
          return executePortableCount(readContext, input);
        });
      },
      tableName: table.tableName,
      specification: table.specification,
      filename: table.filename,
      where(...args: unknown[]) {
        arity('where', args, 1);
        const where = resolveQueryWhere(table, args[0]);
        return next({
          filters: Object.freeze([...state.filters, where]),
        });
      },
      select(...args: unknown[]) {
        return next({ select: fieldList('select', args) });
      },
      async all(...args: unknown[]) {
        arity('all', args, 0);
        return execute(state);
      },
      async *stream(...args: unknown[]) {
        arity('stream', args, 0);
        yield* stream(state);
      },
      first(...args: unknown[]) {
        return firstRow('first', args);
      },
      async firstOrThrow(...args: unknown[]) {
        const row = await firstRow('firstOrThrow', args);
        if (row === null) {
          throw createGtfsQueryError('Query returned no matching rows', {
            reason: 'NO_ROWS',
          });
        }
        return row;
      },
    });
  };
  return build(
    Object.freeze({ filters: Object.freeze([]) }),
  ) as GtfsRepository<string>;
}

export function createGtfsReader<Name extends string, DB>(
  context: RepositoryRuntimeContext<DB>,
): GtfsReader<Name> {
  return createGtfsRepository(context) as unknown as GtfsReader<Name>;
}
