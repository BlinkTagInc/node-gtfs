import type { GtfsExtension } from '../schema/define-table.ts';
import type {
  ResolveGtfsConfigOptions,
  ResolvedGtfsConfig,
  ResolvedGtfsImportConfig,
  ResolvedGtfsExportConfig,
  ResolvedGtfsInstanceConfig,
} from './resolved.ts';
import { resolveGtfsExtensionSelection } from '../schema/extensions.ts';
import { resolveReportingConfig } from '../reporting/options.ts';
import { collectLegacyConfigIssues } from './legacy-diagnostics.ts';
import {
  readConfigObject,
  validateKnownConfigKeys,
  readConfigString,
  readConfigNumber,
  readConfigBoolean,
} from './readers.ts';
import {
  addConfigIssue,
  throwConfigIssues,
  type ConfigValidationContext as ValidationContext,
} from './validation.ts';
import { resolveDatabase } from './database.ts';
import { resolveSources } from './sources.ts';
import { resolveRealtimeRetention } from './realtime.ts';
import { DEFAULT_GTFS_EXPORT_CONFIG } from './defaults.ts';

export type { GtfsConfigIssue } from './validation.ts';
export type * from './resolved.ts';

const KNOWN_KEYS = {
  root: [
    'database',
    'reporting',
    'extensions',
    'sources',
    'realtime',
    'export',
  ],
  export: ['outputDirectory', 'overwrite', 'sourceId', 'batchSize'],
} as const;

function resolveExtensions(
  value: unknown,
  context: ValidationContext,
): readonly GtfsExtension[] | 'auto' {
  if (value === 'auto') {
    if (context.operation !== 'import') {
      addConfigIssue(
        context,
        'invalid-combination',
        'extensions',
        'Configuration option `extensions: "auto"` is supported only by Schedule import',
      );
    }
    return 'auto';
  }
  return resolveGtfsExtensionSelection(value, context);
}

export function resolveExportConfig(
  value: unknown,
  context: ValidationContext,
): ResolvedGtfsConfig['export'] {
  const exportConfig = readConfigObject(value, 'export', context) ?? {};
  validateKnownConfigKeys(exportConfig, 'export', KNOWN_KEYS.export, context);
  const outputDirectory = readConfigString(
    exportConfig.outputDirectory,
    'export.outputDirectory',
    context,
  );
  const sourceId = readConfigString(
    exportConfig.sourceId,
    'export.sourceId',
    context,
  );
  return Object.freeze({
    ...(outputDirectory !== undefined ? { outputDirectory } : {}),
    overwrite: readConfigBoolean(
      exportConfig.overwrite,
      'export.overwrite',
      context,
      DEFAULT_GTFS_EXPORT_CONFIG.overwrite,
    ),
    ...(sourceId !== undefined ? { sourceId } : {}),
    batchSize: readConfigNumber(
      exportConfig.batchSize,
      'export.batchSize',
      context,
      DEFAULT_GTFS_EXPORT_CONFIG.batchSize,
      { integer: true, range: 'positive' },
    ),
  });
}

/** Resolves all configuration domains and reports their collected issues together. */
export function resolveGtfsConfig<DB = unknown>(
  input: unknown,
  options: ResolveGtfsConfigOptions = {},
): ResolvedGtfsConfig<DB> {
  const context: ValidationContext = {
    format: options.format ?? 'javascript',
    operation: options.operation ?? 'instance',
    issues: [],
  };
  collectLegacyConfigIssues(input, '', context.issues);
  const root = readConfigObject(input, 'config', context, true) ?? {};
  validateKnownConfigKeys(root, '', KNOWN_KEYS.root, context);

  const database = resolveDatabase<DB>(root.database, context);
  const reporting = resolveReportingConfig(root.reporting, context);
  const extensions = resolveExtensions(root.extensions, context);
  const sources = resolveSources(root.sources, context);
  const realtime = resolveRealtimeRetention(root.realtime, context);
  const exportConfig = resolveExportConfig(root.export, context);

  if (database === undefined || context.issues.length > 0) {
    throwConfigIssues(context.issues);
  }

  return Object.freeze({
    database,
    reporting,
    extensions,
    sources,
    realtime,
    export: exportConfig,
  });
}

export function resolveGtfsImportConfig<DB = unknown>(
  input: unknown,
  options: Omit<ResolveGtfsConfigOptions, 'operation'> = {},
): ResolvedGtfsImportConfig<DB> {
  return resolveGtfsConfig<DB>(input, {
    ...options,
    operation: 'import',
  }) as ResolvedGtfsImportConfig<DB>;
}

export function resolveGtfsExportConfig<DB = unknown>(
  input: unknown,
  options: Omit<ResolveGtfsConfigOptions, 'operation'> = {},
): ResolvedGtfsExportConfig<DB> {
  return resolveGtfsConfig<DB>(input, {
    ...options,
    operation: 'export',
  }) as ResolvedGtfsExportConfig<DB>;
}

export function resolveGtfsInstanceConfig<DB = unknown>(
  input: unknown,
  options: Omit<ResolveGtfsConfigOptions, 'operation'> = {},
): ResolvedGtfsInstanceConfig<DB> {
  return resolveGtfsConfig<DB>(input, {
    ...options,
    operation: 'instance',
  }) as ResolvedGtfsInstanceConfig<DB>;
}
