import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expandHomeDirectory } from '../io/paths.ts';
import {
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from '../diagnostics/errors.ts';

import type { FlagValues } from './options.ts';

export type CliConfigObject = Record<string, unknown>;

type CliConfigFileArguments = Pick<
  FlagValues,
  'config' | 'database' | 'input' | 'url'
>;

interface CliConfigFile {
  readonly displayPath: string;
  readonly filePath: string;
}

interface LoadCliConfigFileOptions {
  readonly cliArguments: CliConfigFileArguments;
  readonly workingDirectory?: string;
}

function discoverCliConfigFile(
  cliArguments: CliConfigFileArguments,
  workingDirectory: string,
): CliConfigFile | undefined {
  if (cliArguments.config !== undefined) {
    return {
      displayPath: cliArguments.config,
      filePath: path.resolve(
        workingDirectory,
        expandHomeDirectory(cliArguments.config),
      ),
    };
  }

  const filePath = path.resolve(workingDirectory, 'config.json');
  if (!existsSync(filePath)) {
    return undefined;
  }
  return { displayPath: 'config.json', filePath };
}

async function parseCliConfigFile(
  configFile: CliConfigFile,
): Promise<CliConfigObject> {
  let data: string;

  try {
    data = await readFile(configFile.filePath, 'utf8');
  } catch (error) {
    throw new GtfsError(
      `Configuration file not found at ${JSON.stringify(configFile.displayPath)}; pass \`--config\` or start with config-sample.json`,
      {
        code: GtfsErrorCode.CONFIG_FILE_NOT_FOUND,
        category: GtfsErrorCategory.CONFIG,
        details: { filePath: configFile.displayPath },
        cause: error,
      },
    );
  }

  try {
    return JSON.parse(data) as CliConfigObject;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new GtfsError(
      `Invalid JSON in configuration file ${JSON.stringify(configFile.displayPath)}; check JSON syntax`,
      {
        code: GtfsErrorCode.CONFIG_PARSE_FAILED,
        category: GtfsErrorCategory.CONFIG,
        details: { filePath: configFile.displayPath },
        cause: error,
      },
    );
  }
}

function hasDirectConfiguration(cliArguments: CliConfigFileArguments): boolean {
  return Boolean(
    cliArguments.input || cliArguments.url || cliArguments.database,
  );
}

export async function loadCliConfigFile({
  cliArguments,
  workingDirectory = process.cwd(),
}: LoadCliConfigFileOptions): Promise<CliConfigObject> {
  const configFile = discoverCliConfigFile(cliArguments, workingDirectory);
  if (configFile !== undefined) {
    return parseCliConfigFile(configFile);
  }
  if (hasDirectConfiguration(cliArguments)) {
    return {};
  }
  throw new GtfsError(
    'No configuration file found; pass `--config` or create config.json',
    {
      code: GtfsErrorCode.CONFIG_FILE_NOT_FOUND,
      category: GtfsErrorCategory.CONFIG,
    },
  );
}
