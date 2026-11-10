import { assertConfigOptionKeys } from '../config/options.ts';
import type {
  GtfsFieldDefinition,
  GtfsMonetaryDefinition,
  GtfsPresence,
  GtfsRowCondition,
  GtfsSemanticConstraint,
  GtfsSpecification,
} from './define-table.ts';

type DomainField<Field> = Field extends GtfsFieldDefinition
  ? Omit<Field, 'monetary'> & {
      readonly monetary?: Omit<GtfsMonetaryDefinition, 'storageRepresentation'>;
    }
  : never;
export type GtfsDomainFieldDefinition = DomainField<GtfsFieldDefinition>;
export type GtfsDomainFields = Readonly<
  Record<string, GtfsDomainFieldDefinition>
>;
export interface GtfsDomainTableInput<
  Fields extends GtfsDomainFields = GtfsDomainFields,
> {
  readonly specification: GtfsSpecification;
  readonly filename: string | null;
  readonly tableName: string;
  readonly presence: GtfsPresence;
  readonly primaryKey?: readonly Extract<keyof Fields, string>[];
  readonly fields: Fields;
  readonly constraints?: readonly GtfsSemanticConstraint[];
}
export type GtfsDomainTableDefinition = GtfsDomainTableInput & {
  readonly primaryKey: readonly string[];
};

export function validateDomainFields<Fields extends GtfsDomainFields>(
  definition: GtfsDomainTableInput<Fields>,
  fieldNames: ReadonlySet<string>,
): void {
  const tableName = definition.tableName;
  const validateCondition = (condition: GtfsRowCondition, context: string) => {
    if (!fieldNames.has(condition.field)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: ${context} condition references unknown field ${condition.field}`,
      );
    }
    if ((condition.equals === undefined) === (condition.in === undefined)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: ${context} condition must define exactly one of equals or in`,
      );
    }
  };

  for (const [fieldName, field] of Object.entries(definition.fields)) {
    assertConfigOptionKeys(field, {
      name: `defineGtfsTable().fields.${fieldName}`,
      keys: [
        'kind',
        'presence',
        'references',
        'defaultValue',
        'supportsCaseInsensitiveComparison',
        'sourcePath',
        'minimum',
        'maximum',
        'monetary',
        'normalization',
        'values',
        'closed',
      ],
      removed: {
        caseInsensitiveComparison: 'supportsCaseInsensitiveComparison',
      },
    });
    if (field.monetary && !fieldNames.has(field.monetary.currencyField)) {
      throw new Error(
        `Invalid GTFS table ${tableName}: ${fieldName} currency field ${field.monetary.currencyField} is not defined`,
      );
    }
    for (const [index, reference] of (field.references ?? []).entries()) {
      assertConfigOptionKeys(reference, {
        name: `defineGtfsTable().fields.${fieldName}.references[${index}]`,
        keys: ['targetFilename', 'targetField', 'when', 'relationship'],
        removed: { file: 'targetFilename', field: 'targetField' },
      });
      if (reference.when) {
        validateCondition(reference.when, `${fieldName} reference ${index}`);
      }
    }
    for (const [index, normalization] of (
      field.normalization ?? []
    ).entries()) {
      validateCondition(
        normalization.when,
        `${fieldName} normalization ${index}`,
      );
    }
  }

  for (const constraint of definition.constraints ?? []) {
    if (constraint.kind === 'range') {
      if (
        !fieldNames.has(constraint.startField) ||
        !fieldNames.has(constraint.endField)
      ) {
        throw new Error(
          `Invalid GTFS table ${tableName}: range constraint references an unknown field`,
        );
      }
    } else {
      if (!fieldNames.has(constraint.field)) {
        throw new Error(
          `Invalid GTFS table ${tableName}: conditional presence constraint references unknown field ${constraint.field}`,
        );
      }
      validateCondition(constraint.when, `${constraint.field} presence`);
    }
  }
}

export function defineGtfsDomainTable<
  const Definition extends GtfsDomainTableInput,
>(
  definition: Definition,
): Definition & {
  readonly primaryKey: Definition extends {
    readonly primaryKey: infer Key extends readonly string[];
  }
    ? Key
    : readonly [];
} {
  assertConfigOptionKeys(definition, {
    name: 'defineGtfsDomainTable()',
    keys: [
      'specification',
      'filename',
      'tableName',
      'presence',
      'primaryKey',
      'fields',
      'constraints',
    ],
  });
  const fields = new Set(Object.keys(definition.fields));
  for (const name of definition.primaryKey ?? []) {
    if (!fields.has(name)) {
      throw new Error(
        `Invalid GTFS table ${definition.tableName}: primary key field ${name} is not defined`,
      );
    }
  }
  validateDomainFields(definition, fields);
  for (const [name, field] of Object.entries(definition.fields)) {
    if (field.monetary !== undefined) {
      assertConfigOptionKeys(field.monetary, {
        name: `defineGtfsDomainTable().fields.${name}.monetary`,
        keys: ['currencyField', 'publicRepresentation'],
      });
    }
  }
  return { ...definition, primaryKey: definition.primaryKey ?? [] } as never;
}
