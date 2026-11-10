import { deepFreeze } from '../../schema/freeze-metadata.ts';
import { defineGtfsTable } from '../../schema/define-table.ts';
import type { GtfsDomainTableDefinition } from '../../schema/domain-table.ts';
import type { GtfsTableStoragePolicy } from './table-policy.ts';

type ManagedFields<Definition extends GtfsDomainTableDefinition> = {
  readonly [
    Name in keyof Definition['fields']
  ]: Definition['fields'][Name] extends {
    readonly monetary: infer Monetary;
  }
    ? Definition['fields'][Name] & {
        readonly monetary: Monetary & {
          readonly storageRepresentation: 'minor-units';
        };
      }
    : Definition['fields'][Name];
};

/** Compatibility metadata for public schema exports and existing consumers. */
export function toManagedGtfsTable<
  const Definition extends GtfsDomainTableDefinition,
  const Policy extends GtfsTableStoragePolicy,
>(definition: Definition, policy: Policy) {
  const fields = Object.fromEntries(
    Object.entries(definition.fields).map(([name, field]) => [
      name,
      field.monetary
        ? {
            ...field,
            monetary: {
              ...field.monetary,
              storageRepresentation: 'minor-units',
            },
          }
        : field,
    ]),
  );
  return deepFreeze(
    defineGtfsTable({
      ...definition,
      ...policy,
      fields,
    } as never),
  ) as Definition &
    Policy & {
      readonly fields: ManagedFields<Definition>;
      readonly storageKey: Policy extends {
        readonly storageKey: infer Key;
      }
        ? Key
        : readonly ['source_id', ...Definition['primaryKey']];
    };
}
