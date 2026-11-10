import { parseArgs } from 'node:util';

import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';
import { version } from '../version.ts';

import type { GtfsReportingLevel } from '../reporting/types.ts';

const LOG_LEVELS = ['silent', 'error', 'warn', 'info'] as const;

export interface FlagValues {
  readonly config?: string;
  readonly database?: string;
  readonly input?: string;
  readonly output?: string;
  readonly url?: string;
  readonly 'log-level'?: GtfsReportingLevel;
  readonly 'source-id'?: string;
  readonly version?: boolean;
  readonly help?: boolean;
}

export interface Flag {
  readonly name: string;
  readonly short?: string;
  readonly type: 'boolean' | 'string';
  readonly value?: string;
  readonly choices?: readonly string[];
  readonly description: string;
}

export interface CommandSummary {
  readonly name: string;
  readonly summary: string;
}

interface ParseFlagsOptions {
  readonly command: string;
  readonly summary: string;
  readonly flags: readonly Flag[];
  readonly args: readonly string[];
  readonly commands?: readonly CommandSummary[];
}

const COMMON_FLAGS: readonly Flag[] = [
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
  name: 'config',
  short: 'c',
  type: 'string',
  value: 'path',
  description: 'Path to config file [default: ./config.json]',
};

export const LOG_LEVEL_FLAG: Flag = {
  name: 'log-level',
  short: 'l',
  type: 'string',
  value: 'level',
  choices: LOG_LEVELS,
  description: `How much to log: ${LOG_LEVELS.join(', ')}`,
};

export const SQLITE_PATH_FLAG: Flag = {
  name: 'database',
  type: 'string',
  value: 'path',
  description: 'Path to SQLite database',
};

export const SOURCE_ID_FLAG: Flag = {
  name: 'source-id',
  type: 'string',
  value: 'id',
  description: 'Stable GTFS source identity',
};

export const OUTPUT_DIRECTORY_FLAG: Flag = {
  name: 'output',
  type: 'string',
  value: 'directory',
  description: 'Directory for exported GTFS files',
};

function flagSignature(flag: Flag): string {
  return [
    flag.short === undefined ? '    ' : `-${flag.short}, `,
    `--${flag.name}`,
    flag.value === undefined ? '' : ` <${flag.value}>`,
  ].join('');
}

function formatUsage(
  command: string,
  summary: string,
  flags: readonly Flag[],
  commands: readonly CommandSummary[] | undefined,
): string {
  const width = Math.max(...flags.map((flag) => flagSignature(flag).length));
  const commandWidth = Math.max(
    0,
    ...(commands ?? []).map(({ name }) => name.length),
  );

  return [
    `Usage: ${command}${commands === undefined ? '' : ' <command>'} [options]`,
    '',
    summary,
    '',
    ...(commands === undefined
      ? []
      : [
          'Commands:',
          ...commands.map(
            ({ name, summary: description }) =>
              `  ${name.padEnd(commandWidth)}  ${description}`,
          ),
          '',
        ]),
    'Options:',
    ...flags.map(
      (flag) => `  ${flagSignature(flag).padEnd(width)}  ${flag.description}`,
    ),
    '',
    commands === undefined
      ? 'CLI values take precedence as described above.'
      : `Run \`${command} <command> --help\` for command options.`,
    'See https://github.com/BlinkTagInc/node-gtfs',
  ].join('\n');
}

export function parseFlags({
  command,
  summary,
  flags: commandFlags,
  args,
  commands,
}: ParseFlagsOptions): FlagValues {
  const removedFlags = new Map([
    ['--configPath', '--config'],
    ['--logLevel', '--log-level'],
    ['--sqlitePath', '--database'],
    ['--gtfsPath', '--input'],
    ['--gtfsUrl', '--url'],
  ]);
  for (const argument of args) {
    const legacyFlag = argument.split('=', 1).at(0) ?? argument;
    const replacementFlag = removedFlags.get(legacyFlag);
    if (replacementFlag !== undefined) {
      throw new GtfsError(
        `CLI flag \`${legacyFlag}\` was removed; use \`${replacementFlag}\``,
        {
          code: GtfsErrorCode.CONFIG_INVALID,
          category: GtfsErrorCategory.CONFIG,
          details: {
            reason: 'legacy-flag',
            legacyFlag,
            replacementFlag,
          },
        },
      );
    }
  }
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
    ({ values } = parseArgs({ options, args: [...args] }));
  } catch (error) {
    const reason = (error as { code?: string }).code ?? 'invalid-cli-arguments';
    const unknownOption =
      error instanceof Error
        ? error.message.match(/Unknown option '(--?[\w-]+)'/u)?.[1]
        : undefined;
    const message =
      unknownOption !== undefined
        ? `Unknown option ${JSON.stringify(unknownOption)}`
        : reason === 'ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL'
          ? 'Unexpected argument; positional arguments are not supported'
          : 'Invalid command-line arguments';
    throw new GtfsError(
      `${message}; run \`${command} --help\` to see available options`,
      {
        code: GtfsErrorCode.CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
        details: { reason },
        cause: error,
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
        `Invalid value ${JSON.stringify(value)} for \`--${flag.name}\`; expected one of ${flag.choices.map((choice) => JSON.stringify(choice)).join(', ')}`,
        {
          code: GtfsErrorCode.CONFIG_INVALID,
          category: GtfsErrorCategory.CONFIG,
          details: { flag: flag.name, value },
        },
      );
    }
  }

  if (values.help === true || (commands !== undefined && args.length === 0)) {
    process.stdout.write(`${formatUsage(command, summary, flags, commands)}\n`);
    process.exit();
  }

  if (values.version === true) {
    process.stdout.write(`${version}\n`);
    process.exit();
  }

  return values as FlagValues;
}
