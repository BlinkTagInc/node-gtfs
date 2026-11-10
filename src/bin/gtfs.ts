#!/usr/bin/env node

import { runCliCommand } from '../cli/command.ts';
import { importCommand } from '../cli/import.ts';
import { exportCommand } from '../cli/export.ts';
import { realtimeRefreshCommand } from '../cli/realtime-refresh.ts';
import { handleFatalError } from '../reporting/fatal.ts';

runCliCommand({
  command: {
    name: 'gtfs',
    summary: 'Import, export, and refresh GTFS data.',
    commands: [
      importCommand,
      exportCommand,
      {
        name: 'realtime',
        summary: 'Work with GTFS-Realtime feeds.',
        commands: [realtimeRefreshCommand],
      },
    ],
  },
  args: process.argv.slice(2),
}).catch(handleFatalError);
