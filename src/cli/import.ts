import {
  CONFIG_PATH_FLAG,
  LOG_LEVEL_FLAG,
  SOURCE_ID_FLAG,
  SQLITE_PATH_FLAG,
} from './options.ts';
import { loadCliConfig } from './config.ts';
import { createConsoleReporter } from '../reporting/reporters.ts';
import { importGtfs } from '../index.ts';
import type { GtfsImportOptions } from '../types/config.ts';
import type { CliCommand } from './command.ts';

export const importCommand: CliCommand = {
  name: 'import',
  summary: 'Import GTFS into a SQLite database.',
  flags: [
    CONFIG_PATH_FLAG,
    {
      name: 'input',
      type: 'string',
      value: 'path',
      description: 'GTFS ZIP or directory; replaces configured sources',
    },
    {
      name: 'url',
      type: 'string',
      value: 'url',
      description: 'GTFS ZIP URL; replaces configured sources',
    },
    SQLITE_PATH_FLAG,
    {
      ...SOURCE_ID_FLAG,
      description: 'Identity for --input or --url only [default: default]',
    },
    LOG_LEVEL_FLAG,
  ],
  async run(values) {
    const loaded = await loadCliConfig<GtfsImportOptions>(values);
    const config: GtfsImportOptions = {
      ...loaded,
      reporting: {
        ...loaded.reporting,
        reporter: createConsoleReporter(),
      },
    };
    await importGtfs(config);
  },
};
