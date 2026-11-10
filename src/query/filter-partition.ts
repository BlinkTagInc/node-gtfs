import type { CompiledGtfsTable } from '../schema/compile-table.ts';
import { repositoryQueryExtensions } from '../schema/repository-query-extensions.ts';
import { getPortableQueryFields } from '../database/kysely/query/plan.ts';
import { createGtfsQueryError } from '../diagnostics/errors.ts';
import type { DynamicRepositoryWhere } from './filter-context.ts';

const removedSemanticFilters = {
  trips: { date: 'serviceDate' },
  stop_times: {
    date: 'serviceDate',
    start_time: 'query.stopTimes({ window })',
    end_time: 'query.stopTimes({ window })',
    arrivalTimeFrom: 'query.stopTimes({ window })',
    arrivalTimeThrough: 'query.stopTimes({ window })',
  },
  alerts: {
    communication_at: 'communicationActiveAt',
    impact_at: 'impactActiveAt',
  },
} as const;

export function partitionRepositoryWhere(
  table: CompiledGtfsTable,
  where: DynamicRepositoryWhere,
) {
  const fields = getPortableQueryFields(table);
  const semantics =
    repositoryQueryExtensions[
      table.tableName as keyof typeof repositoryQueryExtensions
    ] ?? {};
  const removed: Readonly<Record<string, string>> =
    removedSemanticFilters[
      table.tableName as keyof typeof removedSemanticFilters
    ] ?? {};
  const standardWhere: Record<string, unknown> = Object.create(null);
  const semanticWhere: Record<string, unknown> = Object.create(null);
  for (const [field, value] of Object.entries(where)) {
    if (Object.hasOwn(removed, field)) {
      throw createGtfsQueryError(
        `Semantic filter ${JSON.stringify(field)} was removed; use ${JSON.stringify(removed[field])}`,
        {
          table: table.tableName,
          field,
          replacement: removed[field],
          reason: 'removed-semantic-filter',
        },
      );
    }
    if (Object.hasOwn(semantics, field)) {
      semanticWhere[field] = value;
    } else if (
      fields.has(field) &&
      (value === null ||
        (typeof value !== 'object' && typeof value !== 'function'))
    ) {
      standardWhere[field] = value;
    } else {
      throw createGtfsQueryError(
        'where() objects support field equality and GTFS semantic filters only; use database.withKysely() for operators, boolean groups, or relationships',
        { table: table.tableName, field },
      );
    }
  }
  return { standardWhere, semanticWhere };
}
