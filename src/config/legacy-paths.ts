/** One removed node-GTFS configuration path used only for migration errors. */
export interface GtfsLegacyConfigPath {
  /** Array positions are represented by `[]`. */
  readonly pattern: string;
  /** Final v5 path, or null when the option was removed without replacement. */
  readonly replacementPath: string | null;
  readonly explanation?: string;
}

/**
 * Released configuration paths recognized by the v5 migration validator.
 *
 * This registry never translates or applies a value. Its only runtime use is
 * producing a targeted `GTFS_CONFIG_INVALID` error.
 */
export const GTFS_LEGACY_CONFIG_PATHS: readonly GtfsLegacyConfigPath[] =
  Object.freeze([
    { pattern: 'agencies', replacementPath: 'sources' },
    { pattern: 'sqlitePath', replacementPath: 'database.path' },
    { pattern: 'db', replacementPath: 'database.client' },
    {
      pattern: 'csvOptions',
      replacementPath: 'sources[].schedule.import.csv',
    },
    {
      pattern: 'ignoreDuplicates',
      replacementPath: 'sources[].schedule.import.validation.onDuplicateKey',
      explanation: 'Use "reject" or "keep-first".',
    },
    {
      pattern: 'downloadTimeout',
      replacementPath:
        'sources[].schedule.timeoutMs or sources[].realtime.feeds[].timeoutMs',
    },
    {
      pattern: 'gtfsRealtimeExpirationSeconds',
      replacementPath: 'realtime.retention.currentEntitiesSeconds',
    },
    { pattern: 'exportPath', replacementPath: 'export.outputDirectory' },
    { pattern: 'logLevel', replacementPath: 'reporting.level' },
    { pattern: 'ignoreErrors', replacementPath: null },
    { pattern: 'logFunction', replacementPath: 'reporting.reporter' },
    { pattern: 'verbose', replacementPath: 'reporting.level' },
    {
      pattern: 'agencies[].url',
      replacementPath: 'sources[].schedule.url',
    },
    {
      pattern: 'agencies[].path',
      replacementPath: 'sources[].schedule.path',
    },
    {
      pattern: 'agencies[].headers',
      replacementPath: 'sources[].schedule.requestHeaders',
    },
    {
      pattern: 'agencies[].exclude',
      replacementPath: 'sources[].schedule.excludeFiles',
    },
    {
      pattern: 'agencies[].fillEmptyAgencyId',
      replacementPath: 'sources[].schedule.defaultAgencyId',
    },
    {
      pattern: 'agencies[].agencyId',
      replacementPath: 'sources[].schedule.defaultAgencyId',
    },
    {
      pattern: 'agencies[].realtimeAlerts',
      replacementPath: 'sources[].realtime.feeds[]',
    },
    {
      pattern: 'agencies[].realtimeTripUpdates',
      replacementPath: 'sources[].realtime.feeds[]',
    },
    {
      pattern: 'agencies[].realtimeVehiclePositions',
      replacementPath: 'sources[].realtime.feeds[]',
    },
    {
      pattern: 'agencies[].prefix',
      replacementPath: null,
      explanation:
        'V5 stores original GTFS identifiers unchanged and isolates them with sourceId; reimport the original feed into a fresh v5 database.',
    },
  ]);
