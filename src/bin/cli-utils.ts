import { parseArgs } from 'node:util';

import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from '../lib/errors.ts';
import { version } from '../version.ts';

import type { LogLevel } from '../types/global_interfaces.ts';

const LOG_LEVELS = ['silent', 'error', 'warning', 'info'] as const;

/*
 * The command line as parsed. A flag that wasn't passed is undefined, which is
 * what leaves the matching config.json option alone.
 */
export interface FlagValues {
  configPath?: string;
  logLevel?: LogLevel;
  gtfsPath?: string;
  gtfsUrl?: string;
  sqlitePath?: string;
  version?: boolean;
  help?: boolean;
}

/*
 * One command line flag. `value` is the placeholder shown after the flag in
 * `--help`, for the flags that take one; `choices` is the values it accepts,
 * when it accepts a fixed set of them.
 */
export interface Flag {
  name: string;
  short?: string;
  type: 'boolean' | 'string';
  value?: string;
  choices?: readonly string[];
  description: string;
}

/* Every binary accepts these, and lists them last. */
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

/*
 * The usage text, built from the same flag list the parser is built from, so
 * `--help` and what is actually accepted cannot drift apart.
 */
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

/*
 * Parse the command line for one of the binaries, reporting anything wrong
 * with it the same way as anything wrong with config.json rather than as an
 * unhandled exception. Handles `--help` and `--version` itself, since neither
 * goes on to do any work.
 */
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

  // Every flag has been checked against what it declared it accepts.
  return values as FlagValues;
}
