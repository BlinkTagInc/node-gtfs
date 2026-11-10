import {
  addConfigIssue,
  type ConfigValidationContext as ValidationContext,
} from './validation.ts';

import { fileBackedTables } from '../schema/table-registry.ts';
import type {
  ResolvedGtfsScheduleImportConfig,
  ResolvedGtfsScheduleSourceConfig,
} from './resolved.ts';
import {
  readConfigObject,
  validateKnownConfigKeys,
  readConfigString,
  readConfigEnum,
  readConfigNumber,
} from './readers.ts';
import { resolveDownloadOptions } from './download.ts';
import { resolveCsvParseOptions } from './csv.ts';
import {
  DEFAULT_ARCHIVE_LIMITS,
  DEFAULT_GTFS_SCHEDULE_CONFIG,
} from './defaults.ts';
import type { ArchiveLimits } from '../io/limits.ts';

const FILE_BACKED_FILENAMES = new Set(
  fileBackedTables.map((table) => table.filename),
);
const KNOWN_KEYS = {
  schedule: [
    'url',
    'path',
    'requestHeaders',
    'timeoutMs',
    'excludeFiles',
    'defaultAgencyId',
    'import',
  ],
  scheduleImport: [
    'archive',
    'csv',
    'onExistingData',
    'onSourceError',
    'validation',
  ],
  validation: ['mode', 'onUnknownField', 'onDuplicateKey'],
} as const;

function resolveArchiveLimits(
  value: unknown,
  path: string,
  context: ValidationContext,
): ArchiveLimits {
  const archive = readConfigObject(value, path, context) ?? {};
  validateKnownConfigKeys(
    archive,
    path,
    Object.keys(DEFAULT_ARCHIVE_LIMITS),
    context,
  );
  const readLimit = (key: keyof ArchiveLimits) =>
    readConfigNumber(
      archive[key],
      `${path}.${key}`,
      context,
      DEFAULT_ARCHIVE_LIMITS[key],
      {
        integer: true,
        range: 'positive',
      },
    );
  return Object.freeze({
    maxCompressedBytes: readLimit('maxCompressedBytes'),
    maxEntries: readLimit('maxEntries'),
    maxExtractedFileBytes: readLimit('maxExtractedFileBytes'),
    maxExtractedTotalBytes: readLimit('maxExtractedTotalBytes'),
  });
}

export function resolveScheduleImport(
  value: unknown,
  path: string,
  context: ValidationContext,
): ResolvedGtfsScheduleImportConfig {
  const defaults = DEFAULT_GTFS_SCHEDULE_CONFIG.import;
  const importConfig = readConfigObject(value, path, context) ?? {};
  validateKnownConfigKeys(
    importConfig,
    path,
    KNOWN_KEYS.scheduleImport,
    context,
  );
  const csv = resolveCsvParseOptions(importConfig.csv, `${path}.csv`, context);

  const validationPath = `${path}.validation`;
  const validation =
    readConfigObject(importConfig.validation, validationPath, context) ?? {};
  validateKnownConfigKeys(
    validation,
    validationPath,
    KNOWN_KEYS.validation,
    context,
  );

  return Object.freeze({
    archive: resolveArchiveLimits(
      importConfig.archive,
      `${path}.archive`,
      context,
    ),
    onSourceError: readConfigEnum(
      importConfig.onSourceError,
      `${path}.onSourceError`,
      context,
      ['abort', 'continue'] as const,
      defaults.onSourceError,
    ),
    onExistingData: readConfigEnum(
      importConfig.onExistingData,
      `${path}.onExistingData`,
      context,
      ['replace-source', 'reject'] as const,
      defaults.onExistingData,
    ),
    csv,
    validation: Object.freeze({
      mode: readConfigEnum(
        validation.mode,
        `${validationPath}.mode`,
        context,
        ['off', 'strict', 'permissive'] as const,
        defaults.validation.mode,
      ),
      onUnknownField: readConfigEnum(
        validation.onUnknownField,
        `${validationPath}.onUnknownField`,
        context,
        ['reject', 'preserve', 'discard'] as const,
        defaults.validation.onUnknownField,
      ),
      onDuplicateKey: readConfigEnum(
        validation.onDuplicateKey,
        `${validationPath}.onDuplicateKey`,
        context,
        ['reject', 'keep-first'] as const,
        defaults.validation.onDuplicateKey,
      ),
    }),
  });
}

export function resolveScheduleSource(
  value: unknown,
  path: string,
  context: ValidationContext,
): ResolvedGtfsScheduleSourceConfig | undefined {
  const schedule = readConfigObject(value, path, context);
  if (!schedule) {
    return undefined;
  }
  validateKnownConfigKeys(schedule, path, KNOWN_KEYS.schedule, context);
  const url = readConfigString(schedule.url, `${path}.url`, context);
  const localPath = readConfigString(schedule.path, `${path}.path`, context);
  if ((url === undefined) === (localPath === undefined)) {
    addConfigIssue(
      context,
      'invalid-combination',
      path,
      `Configuration option \`${path}\` must define exactly one of \`url\` or \`path\``,
    );
  }
  if (
    localPath !== undefined &&
    (schedule.requestHeaders !== undefined || schedule.timeoutMs !== undefined)
  ) {
    addConfigIssue(
      context,
      'invalid-combination',
      path,
      `Configuration options \`${path}.requestHeaders\` and \`${path}.timeoutMs\` are available only with \`${path}.url\``,
    );
  }
  const excludeFiles: string[] =
    schedule.excludeFiles === undefined
      ? [...DEFAULT_GTFS_SCHEDULE_CONFIG.excludeFiles]
      : [];
  if (schedule.excludeFiles !== undefined) {
    if (!Array.isArray(schedule.excludeFiles)) {
      addConfigIssue(
        context,
        'invalid-type',
        `${path}.excludeFiles`,
        `Configuration option \`${path}.excludeFiles\` must be an array of GTFS filenames`,
      );
    } else {
      for (const [index, filename] of schedule.excludeFiles.entries()) {
        const filenamePath = `${path}.excludeFiles[${index}]`;
        if (
          typeof filename !== 'string' ||
          !FILE_BACKED_FILENAMES.has(filename)
        ) {
          addConfigIssue(
            context,
            'invalid-value',
            filenamePath,
            `Configuration option \`${filenamePath}\` must be a recognized GTFS source filename`,
          );
        } else {
          excludeFiles.push(filename);
        }
      }
    }
  }
  const common = {
    excludeFiles: Object.freeze(excludeFiles),
    ...(readConfigString(
      schedule.defaultAgencyId,
      `${path}.defaultAgencyId`,
      context,
    ) !== undefined
      ? { defaultAgencyId: schedule.defaultAgencyId as string }
      : {}),
    import: resolveScheduleImport(schedule.import, `${path}.import`, context),
  };
  if (url !== undefined) {
    return Object.freeze({
      ...common,
      url,
      ...resolveDownloadOptions({
        value: schedule,
        path,
        context,
        defaults: DEFAULT_GTFS_SCHEDULE_CONFIG,
      }),
    });
  }
  return Object.freeze({ ...common, path: localPath ?? '' });
}
