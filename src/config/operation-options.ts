import { isPlainObject } from './options.ts';
import { readOperationSignal } from '../cancellation.ts';
import { collectLegacyConfigIssues } from './legacy-diagnostics.ts';
import {
  addConfigIssue,
  throwConfigIssues,
  type ConfigValidationContext,
} from './validation.ts';
import { readConfigObject } from './readers.ts';
import { resolveSources } from './sources.ts';
import { resolveScheduleImport } from './schedule.ts';
import { resolveRealtimeRetention } from './realtime.ts';
import { resolveExportConfig } from './resolver.ts';
import { resolveReportingConfig } from '../reporting/options.ts';
import type {
  ResolvedGtfsInstanceConfig,
  ResolvedGtfsImportConfig,
  ResolvedGtfsRealtimeRefreshConfig,
} from './resolved.ts';

function readOperationOptions(
  args: readonly unknown[],
  keys: readonly string[],
  context: ConfigValidationContext,
) {
  if (args.length > 1) {
    addConfigIssue(
      context,
      'invalid-combination',
      'options',
      'Pass at most one operation options object',
    );
  }
  const value = args.length === 0 ? {} : args[0];
  const options = readConfigObject(value, 'options', context, true) ?? {};
  const allowedKeys = [...keys, 'signal'];
  readOperationSignal(options);
  collectLegacyConfigIssues(options, '', context.issues);
  for (const [key, value] of Object.entries(options)) {
    if (!allowedKeys.includes(key)) {
      addConfigIssue(
        context,
        'unknown-option',
        key,
        `Unknown operation option ${JSON.stringify(key)}`,
      );
    } else if (value === undefined) {
      addConfigIssue(
        context,
        'invalid-type',
        key,
        `Omit ${JSON.stringify(key)} instead of passing undefined`,
      );
    }
  }
  return options;
}

function createOperationValidationContext(
  operation: ConfigValidationContext['operation'],
): ConfigValidationContext {
  return { operation, format: 'javascript', issues: [] };
}

function finishOperationConfig<T>(
  value: T,
  validation: ConfigValidationContext,
): T {
  if (validation.issues.length > 0) {
    throwConfigIssues(validation.issues);
  }
  return Object.freeze(value);
}

function validateSourceScope(
  sourceId: string,
  sourceIds: readonly string[] | null,
  path: string,
  validation: ConfigValidationContext,
) {
  if (sourceIds !== null && !sourceIds.includes(sourceId)) {
    addConfigIssue(
      validation,
      'invalid-combination',
      path,
      `${path} is outside this instance's source scope`,
    );
  }
}

function resolveOperationSources<DB>(
  defaults: ResolvedGtfsInstanceConfig<DB>,
  options: Record<string, unknown>,
  sourceIds: readonly string[] | null,
  kind: 'schedule' | 'realtime',
  validation: ConfigValidationContext,
) {
  if (!Object.hasOwn(options, 'sources')) {
    const selected = defaults.sources.filter(
      (source) => source[kind] !== undefined,
    );
    if (selected.length === 0) {
      addConfigIssue(
        validation,
        'missing-value',
        'sources',
        `Provide sources with ${kind} inputs on the operation or instance`,
      );
    }
    return selected;
  }
  if (Array.isArray(options.sources)) {
    for (const [index, source] of options.sources.entries()) {
      if (!isPlainObject(source)) {
        continue;
      }
      if (source.sourceId === undefined) {
        addConfigIssue(
          validation,
          'missing-value',
          `sources[${index}].sourceId`,
          'Operation sources require an explicit sourceId',
        );
      }
      for (const key of Object.keys(source)) {
        if (key !== 'sourceId' && key !== kind) {
          addConfigIssue(
            validation,
            'unknown-option',
            `sources[${index}].${key}`,
            `Operation sources accept only sourceId and ${kind}`,
          );
        }
      }
    }
  }
  const sources = resolveSources(options.sources, validation);
  for (const [index, source] of sources.entries()) {
    validateSourceScope(
      source.sourceId,
      sourceIds,
      `sources[${index}].sourceId`,
      validation,
    );
  }
  return sources;
}

export function resolveInstanceImportOptions<DB>(
  defaults: ResolvedGtfsInstanceConfig<DB>,
  sourceIds: readonly string[] | null,
  args: readonly unknown[],
): ResolvedGtfsImportConfig<DB> {
  const validation = createOperationValidationContext('import');
  const options = readOperationOptions(
    args,
    ['sources', 'validation', 'reporting'],
    validation,
  );
  const signal = readOperationSignal(options);
  const overrides = readConfigObject(
    options.validation,
    'validation',
    validation,
  );
  const sources = resolveOperationSources(
    defaults,
    options,
    sourceIds,
    'schedule',
    validation,
  ).map((source, index) => {
    if (source.schedule === undefined || overrides === undefined) {
      return source;
    }
    return Object.freeze({
      ...source,
      schedule: Object.freeze({
        ...source.schedule,
        import: resolveScheduleImport(
          {
            ...source.schedule.import,
            validation: { ...source.schedule.import.validation, ...overrides },
          },
          `sources[${index}].schedule.import`,
          validation,
        ),
      }),
    });
  });
  return finishOperationConfig(
    {
      ...defaults,
      ...(signal === undefined ? {} : { signal }),
      sources: Object.freeze(sources),
      reporting:
        options.reporting === undefined
          ? defaults.reporting
          : resolveReportingConfig(options.reporting, validation),
    },
    validation,
  ) as ResolvedGtfsImportConfig<DB>;
}

export function resolveInstanceRefreshOptions<DB>(
  defaults: ResolvedGtfsInstanceConfig<DB>,
  sourceIds: readonly string[] | null,
  args: readonly unknown[],
): ResolvedGtfsRealtimeRefreshConfig<DB> {
  const validation = createOperationValidationContext('realtime');
  const options = readOperationOptions(
    args,
    ['sources', 'retention', 'reporting'],
    validation,
  );
  const signal = readOperationSignal(options);
  const retention = readConfigObject(
    options.retention,
    'retention',
    validation,
  );
  return finishOperationConfig(
    {
      ...defaults,
      ...(signal === undefined ? {} : { signal }),
      sources: Object.freeze(
        resolveOperationSources(
          defaults,
          options,
          sourceIds,
          'realtime',
          validation,
        ),
      ),
      realtime:
        retention === undefined
          ? defaults.realtime
          : resolveRealtimeRetention(
              { retention: { ...defaults.realtime.retention, ...retention } },
              validation,
            ),
      reporting:
        options.reporting === undefined
          ? defaults.reporting
          : resolveReportingConfig(options.reporting, validation),
    },
    validation,
  ) as ResolvedGtfsRealtimeRefreshConfig<DB>;
}

export function resolveInstanceExportOptions<DB>(
  defaults: ResolvedGtfsInstanceConfig<DB>,
  sourceIds: readonly string[] | null,
  args: readonly unknown[],
): ResolvedGtfsInstanceConfig<DB> {
  const validation = createOperationValidationContext('export');
  const options = readOperationOptions(
    args,
    ['outputDirectory', 'overwrite', 'batchSize', 'sourceId', 'reporting'],
    validation,
  );
  const signal = readOperationSignal(options);
  const { reporting, signal: _signal, ...exportOptions } = options;
  const selected = resolveExportConfig(
    { ...defaults.export, ...exportOptions },
    validation,
  );
  const sourceId =
    selected.sourceId ?? (sourceIds?.length === 1 ? sourceIds[0] : undefined);
  if (sourceId !== undefined) {
    validateSourceScope(sourceId, sourceIds, 'export.sourceId', validation);
  } else if (sourceIds !== null) {
    addConfigIssue(
      validation,
      'missing-value',
      'export.sourceId',
      'Select a sourceId when exporting from a multi-source instance',
    );
  }
  return finishOperationConfig(
    {
      ...defaults,
      ...(signal === undefined ? {} : { signal }),
      export: Object.freeze({
        ...selected,
        ...(sourceId === undefined ? {} : { sourceId }),
      }),
      reporting:
        reporting === undefined
          ? defaults.reporting
          : resolveReportingConfig(reporting, validation),
    },
    validation,
  );
}
