import {
  CONFIG_PATH_FLAG,
  LOG_LEVEL_FLAG,
  OUTPUT_DIRECTORY_FLAG,
  SOURCE_ID_FLAG,
  SQLITE_PATH_FLAG,
} from './options.ts';
import { loadCliConfig } from './config.ts';
import { createConsoleReporter } from '../reporting/reporters.ts';
import { exportGtfs } from '../index.ts';
import type { GtfsExportOptions } from '../types/config.ts';
import type { CliCommand } from './command.ts';

export const exportCommand: CliCommand = {
  name: 'export',
  summary: 'Export a SQLite database to GTFS files.',
  flags: [
    CONFIG_PATH_FLAG,
    SQLITE_PATH_FLAG,
    {
      ...SOURCE_ID_FLAG,
      description: 'Source ID to export',
    },
    OUTPUT_DIRECTORY_FLAG,
    LOG_LEVEL_FLAG,
  ],
  async run(values) {
    const loaded = await loadCliConfig<GtfsExportOptions>(values, 'export');
    const config: GtfsExportOptions = {
      ...loaded,
      reporting: {
        ...loaded.reporting,
        reporter: createConsoleReporter(),
      },
    };
    await exportGtfs(config);
  },
};
