import {
  CONFIG_PATH_FLAG,
  LOG_LEVEL_FLAG,
  SQLITE_PATH_FLAG,
} from './options.ts';
import { loadCliConfig } from './config.ts';
import { createConsoleReporter } from '../reporting/reporters.ts';
import { refreshGtfsRealtime } from '../index.ts';
import type { GtfsRealtimeRefreshOptions } from '../types/config.ts';
import type { CliCommand } from './command.ts';

export const realtimeRefreshCommand: CliCommand = {
  name: 'refresh',
  summary: 'Refresh GTFS-Realtime data in a SQLite database.',
  flags: [CONFIG_PATH_FLAG, SQLITE_PATH_FLAG, LOG_LEVEL_FLAG],
  async run(values) {
    const loaded = await loadCliConfig<GtfsRealtimeRefreshOptions>(
      values,
      'realtime',
    );
    const config: GtfsRealtimeRefreshOptions = {
      ...loaded,
      reporting: {
        ...loaded.reporting,
        reporter: createConsoleReporter(),
      },
    };
    await refreshGtfsRealtime(config);
  },
};
