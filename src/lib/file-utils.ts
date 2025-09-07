import path from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { omit, snakeCase } from 'lodash-es';
import sanitize from 'sanitize-filename';
import StreamZip from 'node-stream-zip';
import type { Config } from '../types/global_interfaces.ts';

import { log } from './log-utils.ts';

const homeDirectory = homedir();

/** Configuration command line arguments interface */
interface ConfigArgs {
  configPath?: string;
  gtfsPath?: string;
  gtfsUrl?: string;
  sqlitePath?: string;
}

/**
 * Attempts to parse and load configuration from various sources
 * Priority: 1. CLI config path 2. CLI direct args 3. ./config.json
 * @param {ConfigArgs} argv - Command line arguments
 * @throws {Error} If configuration cannot be found or parsed
 * @returns {Promise<Record<string, any>>} Parsed configuration object
 * @example
 * const config = await getConfig({ configPath: './my-config.json' });
 */
export async function getConfig(argv: ConfigArgs): Promise<Config> {
  let config;
  let data;

  try {
    if (argv.configPath) {
      const configPath = path.resolve(untildify(argv.configPath));
      data = await readFile(configPath, 'utf8');
      config = Object.assign(JSON.parse(data), argv);
    } else if (argv.gtfsPath || argv.gtfsUrl || argv.sqlitePath) {
      const agencies = [
        ...(argv.gtfsPath ? [{ path: argv.gtfsPath }] : []),
        ...(argv.gtfsUrl ? [{ url: argv.gtfsUrl }] : []),
      ];

      config = {
        agencies,
        ...omit(argv, ['path', 'url']),
      };
    } else if (existsSync(path.resolve('./config.json'))) {
      data = await readFile(path.resolve('./config.json'), 'utf8');
      config = Object.assign(JSON.parse(data), argv);
      log(config)('Using configuration from ./config.json');
    } else {
      throw new Error(
        'Cannot find configuration file. Use config-sample.json as a starting point, pass --configPath option.',
      );
    }

    return config;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Cannot parse configuration file. Check to ensure that it is valid JSON. Error: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Prepares a directory for saving files by clearing its contents
 * @param {string} exportPath - Path to the directory to prepare
 * @returns {Promise<void>}
 * @example
 * await prepDirectory('./output');
 */
export async function prepDirectory(exportPath: string): Promise<void> {
  await rm(exportPath, { recursive: true, force: true });
  await mkdir(exportPath, { recursive: true });
}

/**
 * Extracts contents of a zip file to specified directory
 * @param {string} zipfilePath - Path to the zip file
 * @param {string} exportPath - Directory to extract contents to
 * @returns {Promise<void>}
 * @throws {Error} If zip file cannot be opened or extracted
 * @example
 * await unzip('./data.zip', './extracted');
 */
export async function unzip(
  zipfilePath: string,
  exportPath: string,
): Promise<void> {
  try {
    const zip = new StreamZip.async({ file: zipfilePath });
    await zip.extract(null, exportPath);
    await zip.close();
  } catch (error) {
    throw new Error(
      `Failed to extract zip file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Generates a safe folder name from input string
 * Converts to snake_case and removes unsafe characters
 * @param {string} folderName - Input string to convert to folder name
 * @returns {string} Sanitized folder name
 * @example
 * generateFolderName('My Folder!') // returns 'my_folder'
 */
export function generateFolderName(folderName: string): string {
  if (!folderName || typeof folderName !== 'string') {
    throw new Error('Folder name must be a non-empty string');
  }
  return snakeCase(sanitize(folderName));
}

/**
 * Converts a tilde path to a full path
 * @param pathWithTilde The path to convert
 * @returns The full path
 */
export function untildify(pathWithTilde: string): string {
  return homeDirectory
    ? pathWithTilde.replace(/^~(?=$|\/|\\)/, homeDirectory)
    : pathWithTilde;
}
