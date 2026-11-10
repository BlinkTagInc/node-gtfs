interface SyntheticField {
  readonly kind: 'bounds' | 'date' | 'timestamp';
}

type QueryExtensionDefinition = Readonly<Record<string, SyntheticField>>;

/**
 * Library-defined semantic filters layered beside exact GTFS table fields.
 * This metadata is also an input to checked-in repository generation.
 */
export const repositoryQueryExtensions = {
  stops: {
    withinBounds: { kind: 'bounds' },
  },
  trips: {
    serviceDate: { kind: 'date' },
  },
  stop_times: {
    serviceDate: { kind: 'date' },
  },
  alerts: {
    communicationActiveAt: { kind: 'timestamp' },
    impactActiveAt: { kind: 'timestamp' },
  },
} as const satisfies Readonly<Record<string, QueryExtensionDefinition>>;

type ExtensionValue<Definition> = Definition extends { kind: 'date' }
  ? number
  : Definition extends { kind: 'timestamp' }
    ? number | bigint
    : Definition extends { kind: 'bounds' }
      ? GtfsCoordinateBounds
      : never;

/** Inclusive geographic bounds used to filter stops by latitude/longitude. */
export interface GtfsCoordinateBounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** Extra typed `where` fields supported by one repository query. */
export type GtfsRepositoryQueryExtensionRow<TableName extends string> =
  TableName extends keyof typeof repositoryQueryExtensions
    ? {
        readonly [
          Field in keyof (typeof repositoryQueryExtensions)[TableName]
        ]: ExtensionValue<(typeof repositoryQueryExtensions)[TableName][Field]>;
      }
    : Record<never, never>;
