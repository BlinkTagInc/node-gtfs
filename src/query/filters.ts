import type { RawBuilder } from 'kysely';
import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import type {
  RepositoryFilterCompileContext,
  DynamicRepositoryWhere,
} from './filter-context.ts';
import { partitionRepositoryWhere } from './filter-partition.ts';
import { compileSemanticFilters } from './semantic-filters.ts';
import { assertDefinedWhereValues } from './where-validation.ts';
import { compilePortableWhereExpressions } from '../database/kysely/query/predicates.ts';
import { getFilterCurrencyScope } from '../database/kysely/query/filter-values.ts';
import type { GtfsDatabaseDialect } from '../database/dialects.ts';

interface CompiledRepositoryFilters {
  readonly additionalWhere: readonly RawBuilder<boolean>[];
  readonly relatedTables: readonly CompiledGtfsTable[];
  readonly requiredColumns: ReadonlyMap<string, ReadonlySet<string>>;
}

export function compileRepositoryFilters({
  dialect,
  table,
  where,
  filters = [],
}: {
  readonly dialect: GtfsDatabaseDialect;
  readonly table: CompiledGtfsTable;
  readonly where?: DynamicRepositoryWhere | undefined;
  readonly filters?: readonly DynamicRepositoryWhere[];
}): CompiledRepositoryFilters {
  const entries = where === undefined ? filters : [...filters, where];
  const context: RepositoryFilterCompileContext = {
    relatedTables: new Map(),
    requiredColumns: new Map(),
  };
  // Chained equality objects are separate conjuncts. Merging them would lose
  // contradictory filters; currency normalization still needs the whole scope.
  const currencyWhere = Object.assign(
    {},
    ...entries.map(getFilterCurrencyScope),
  );
  const additionalWhere = entries.flatMap((entry) => {
    assertDefinedWhereValues(entry, table.tableName);
    const partition = partitionRepositoryWhere(table, entry);
    return [
      ...compilePortableWhereExpressions({
        dialect,
        table,
        where: partition.standardWhere,
        qualifier: table.tableName,
        requiredColumns: context.requiredColumns,
        currencyWhere,
      }),
      ...compileSemanticFilters({
        tableName: table.tableName,
        where: partition.semanticWhere,
        outerTable: table.tableName,
        context,
      }),
    ];
  });
  return {
    additionalWhere,
    relatedTables: [...context.relatedTables.values()],
    requiredColumns: context.requiredColumns,
  };
}
