import type {
  GtfsDomainFieldDefinition as GtfsFieldDefinition,
  GtfsDomainTableInput,
} from './domain-table.ts';

type SupplementFields<
  Fields extends Readonly<Record<string, GtfsFieldDefinition>>,
  Key extends keyof Fields,
> = {
  readonly [Field in keyof Fields]: Omit<
    Fields[Field],
    'presence' | 'defaultValue'
  > & {
    readonly presence: Field extends Key ? 'required' : 'optional';
  };
};

const supplementedFilenames = new Set([
  'calendar.txt',
  'calendar_dates.txt',
  'routes.txt',
  'stops.txt',
  'stop_times.txt',
  'trips.txt',
]);

/** Supplement blanks mean unchanged, so only identity fields are required. */
export function createTodsSupplementFields<
  const Fields extends Readonly<Record<string, GtfsFieldDefinition>>,
  const Key extends Extract<keyof Fields, string>,
>(
  table: GtfsDomainTableInput<Fields>,
  primaryKey: readonly Key[],
): SupplementFields<Fields, Key> {
  return Object.fromEntries(
    Object.entries(table.fields).map(([name, field]) => {
      const {
        presence: _presence,
        defaultValue: _defaultValue,
        ...definition
      } = field;
      const references = field.references?.flatMap((reference) =>
        supplementedFilenames.has(reference.targetFilename)
          ? [
              reference,
              {
                ...reference,
                targetFilename: reference.targetFilename.replace(
                  '.txt',
                  '_supplement.txt',
                ),
              },
            ]
          : [reference],
      );
      return [
        name,
        {
          ...definition,
          ...(references === undefined ? {} : { references }),
          presence: primaryKey.includes(name as Key) ? 'required' : 'optional',
        },
      ];
    }),
  ) as SupplementFields<Fields, Key>;
}

export const todsDeleteField = {
  kind: 'enumeration',
  values: [1],
  closed: true,
} as const;
