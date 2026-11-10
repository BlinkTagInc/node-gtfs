import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import { redactUrlForReporting } from '../reporting/format.ts';
import { DEFAULT_GTFS_SOURCE_ID } from '../config/defaults.ts';

import type { CliConfigObject } from './config-file.ts';
import type { FlagValues } from './options.ts';

export type CliOperation = 'export' | 'import' | 'realtime';

interface ApplyCliConfigOverridesOptions {
  readonly config: CliConfigObject;
  readonly cliArguments: FlagValues;
  readonly operation: CliOperation;
}

function isRecord(value: unknown): value is CliConfigObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createDirectScheduleSource(cliArguments: FlagValues): unknown[] {
  if (cliArguments.input !== undefined && cliArguments.url !== undefined) {
    throw new GtfsError('Use either `--input` or `--url`, not both', {
      code: GtfsErrorCode.CONFIG_INVALID,
      category: GtfsErrorCategory.CONFIG,
      details: {
        input: cliArguments.input,
        url: redactUrlForReporting(cliArguments.url),
      },
    });
  }

  return [
    {
      sourceId: cliArguments['source-id'] ?? DEFAULT_GTFS_SOURCE_ID,
      schedule:
        cliArguments.input === undefined
          ? { url: cliArguments.url as string }
          : { path: cliArguments.input },
    },
  ];
}

export function applyCliConfigOverrides({
  config: input,
  cliArguments,
  operation,
}: ApplyCliConfigOverridesOptions): CliConfigObject {
  if (
    operation === 'import' &&
    cliArguments['source-id'] !== undefined &&
    cliArguments.input === undefined &&
    cliArguments.url === undefined
  ) {
    throw new GtfsError(
      '`gtfs import --source-id` requires `--input` or `--url`; set the `sources[].sourceId` configuration option in config.json (or the file passed with --config) for configured feeds',
      {
        code: GtfsErrorCode.CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
        details: {
          command: 'gtfs import',
          flag: 'source-id',
          reason: 'requires-direct-input',
          requiredFlags: ['input', 'url'],
          configPath: 'sources[].sourceId',
        },
      },
    );
  }

  const config = { ...input };

  if (cliArguments.database !== undefined) {
    config.database = {
      path: cliArguments.database,
    };
  }

  if (cliArguments['log-level'] !== undefined) {
    config.reporting = {
      ...(isRecord(config.reporting) ? config.reporting : {}),
      level: cliArguments['log-level'],
    };
  }

  if (
    operation === 'import' &&
    (cliArguments.input !== undefined || cliArguments.url !== undefined)
  ) {
    config.sources = createDirectScheduleSource(cliArguments);
  }

  if (
    operation === 'export' &&
    (cliArguments['source-id'] !== undefined ||
      cliArguments.output !== undefined)
  ) {
    config.export = {
      ...(isRecord(config.export) ? config.export : {}),
      ...(cliArguments['source-id'] === undefined
        ? {}
        : { sourceId: cliArguments['source-id'] }),
      ...(cliArguments.output === undefined
        ? {}
        : { outputDirectory: cliArguments.output }),
    };
  }

  return config;
}
