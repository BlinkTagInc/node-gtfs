#!/usr/bin/env node

import { CONFIG_PATH_FLAG, LOG_LEVEL_FLAG, parseFlags } from './cli-utils.ts';
import { getConfig } from '../lib/file-utils.ts';
import { handleFatalError } from '../reporting/fatal.ts';
import { updateGtfsRealtime } from '../index.ts';
import type { GtfsRealtimeConfig } from '../types/config.ts';

const setupUpdate = async () => {
  const values = parseFlags(
    'gtfsrealtime-update',
    'Refresh GTFS-Realtime data in a SQLite database.',
    [CONFIG_PATH_FLAG, LOG_LEVEL_FLAG],
  );

  const config = await getConfig<GtfsRealtimeConfig>(values);
  await updateGtfsRealtime(config);
  process.exit();
};

setupUpdate().catch(handleFatalError);
