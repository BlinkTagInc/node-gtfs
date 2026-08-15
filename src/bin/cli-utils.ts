import { parseArgs } from 'node:util';

import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from '../lib/errors.ts';
import { version } from '../version.ts';

import type { LogLevel } from '../types/global_interfaces.ts';

const LOG_LEVELS = ['silent', 'error', 'warning', 'info'] as const;

export interface FlagValues {
  configPath?: string;
  logLevel?: LogLevel;
  gtfsPath?: string;
  gtfsUrl?: string;
  sqlitePath?: string;
  version?: boolean;
  help?: boolean;
}

export interface Flag {
  name: string;
  short?: string;
  type: 'boolean' | 'string';
  value?: string;
  choices?: readonly string[];
  description: string;
}

const COMMON_FLAGS: Flag[] = [
  {
    name: 'version',
    short: 'v',
    type: 'boolean',
    description: 'Show the node-GTFS version',
  },
  {
    name: 'help',
    short: 'h',
    type: 'boolean',
    description: 'Show this help',
  },
];

export const CONFIG_PATH_FLAG: Flag = {
  name: 'configPath',
  short: 'c',
  type: 'string',
  value: 'path',
  description: 'Path to config file [default: ./config.json]',
};

export const LOG_LEVEL_FLAG: Flag = {
  name: 'logLevel',
  short: 'l',
  type: 'string',
  value: 'level',
  choices: LOG_LEVELS,
  description: `How much to log: ${LOG_LEVELS.join(', ')}`,
};

export const SQLITE_PATH_FLAG: Flag = {
  name: 'sqlitePath',
  type: 'string',
  value: 'path',
  description: 'Path to SQLite database',
};

const flagSignature = (flag: Flag) =>
  [
    flag.short === undefined ? '    ' : `-${flag.short}, `,
    `--${flag.name}`,
    flag.value === undefined ? '' : ` <${flag.value}>`,
  ].join('');

function formatUsage(command: string, summary: string, flags: Flag[]) {
  const width = Math.max(...flags.map((flag) => flagSignature(flag).length));

  return [
    `Usage: ${command} [options]`,
    '',
    summary,
    '',
    'Options:',
    ...flags.map(
      (flag) => `  ${flagSignature(flag).padEnd(width)}  ${flag.description}`,
    ),
    '',
    'Every option but --version and --help overrides the option of the same',
    'name in config.json. See https://github.com/BlinkTagInc/node-gtfs',
  ].join('\n');
}

export function parseFlags(
  command: string,
  summary: string,
  commandFlags: Flag[],
) {
  const flags = [...commandFlags, ...COMMON_FLAGS];
  const options = Object.fromEntries(
    flags.map((flag) => [
      flag.name,
      // `parseArgs` rejects a `short` that is present but undefined.
      flag.short === undefined
        ? { type: flag.type }
        : { type: flag.type, short: flag.short },
    ]),
  );

  let values;

  try {
    ({ values } = parseArgs({ options }));
  } catch (error) {
    throw new GtfsError(
      `${error instanceof Error ? error.message : String(error)} - run \`${command} --help\` to see every option`,
      {
        code: GtfsErrorCode.GTFS_CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
        details: { argv: process.argv.slice(2) },
      },
    );
  }

  for (const flag of flags) {
    const value = values[flag.name];

    if (
      flag.choices !== undefined &&
      typeof value === 'string' &&
      !flag.choices.includes(value)
    ) {
      throw new GtfsError(
        `Invalid --${flag.name}=${value} - use one of ${flag.choices.join(', ')}`,
        {
          code: GtfsErrorCode.GTFS_CONFIG_INVALID,
          category: GtfsErrorCategory.CONFIG,
          details: { flag: flag.name, value },
        },
      );
    }
  }

  if (values.help === true) {
    process.stdout.write(`${formatUsage(command, summary, flags)}\n`);
    process.exit();
  }

  if (values.version === true) {
    process.stdout.write(`${version}\n`);
    process.exit();
  }

  return values as FlagValues;
}
