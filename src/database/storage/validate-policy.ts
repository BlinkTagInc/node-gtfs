import type { GtfsTableDefinition } from '../../schema/define-table.ts';
import { getServiceDaySecondsFieldName } from '../../schema/compile-table.ts';

type StoragePolicyInput = Omit<
  GtfsTableDefinition,
  'primaryKey' | 'storageKey'
> &
  Partial<Pick<GtfsTableDefinition, 'primaryKey' | 'storageKey'>>;

export function validateStorageKeyDefinition(
  definition: StoragePolicyInput,
  fieldNames: ReadonlySet<string>,
): void {
  const tableName = definition.tableName;
  const storageKey =
    definition.storageKey === undefined
      ? (['source_id', ...(definition.primaryKey ?? [])] as const)
      : definition.storageKey;
  const keyStrategy = definition.keyStrategy;

  if (keyStrategy === 'canonical' && !definition.primaryKey?.length) {
    throw new Error(
      `Invalid GTFS table ${tableName}: a canonical key strategy requires a primary key`,
    );
  }
  if ((keyStrategy === 'none') !== (storageKey === null)) {
    throw new Error(
      `Invalid GTFS table ${tableName}: a none key strategy requires a null storage key and vice versa`,
    );
  }
  for (const storageField of storageKey ?? []) {
    if (storageField !== 'source_id' && !fieldNames.has(storageField)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: storage key field ${storageField} is not defined`,
      );
    }
  }
  for (const primaryField of definition.primaryKey ?? []) {
    if (!storageKey?.includes(primaryField)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: storage key must include primary key field ${primaryField}`,
      );
    }
  }
}

export function validateIndexDefinitions(
  definition: StoragePolicyInput,
  fieldNames: ReadonlySet<string>,
): void {
  const tableName = definition.tableName;
  for (const configuredIndex of definition.indexes ?? []) {
    const indexColumns =
      typeof configuredIndex === 'string' ? [configuredIndex] : configuredIndex;
    for (const column of indexColumns) {
      if (column === 'source_id') {
        continue;
      }
      const isGeneratedServiceDaySeconds = Object.entries(
        definition.fields,
      ).some(
        ([fieldName, field]) =>
          field.kind === 'time' &&
          getServiceDaySecondsFieldName(fieldName) === column,
      );
      if (!fieldNames.has(column) && !isGeneratedServiceDaySeconds) {
        throw new Error(
          `Invalid GTFS table ${tableName}: index field ${column} is not defined`,
        );
      }
    }
  }
}
