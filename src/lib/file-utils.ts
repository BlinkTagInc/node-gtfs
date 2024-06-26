import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { omit, snakeCase } from 'lodash-es';
import sanitize from 'sanitize-filename';
import untildify from 'untildify';
import StreamZip from 'node-stream-zip';

/*
 * Attempt to parse any config JSON file and read values from CLI.
 */
export async function getConfig(argv: {
  configPath?: string;
  gtfsPath?: string;
  gtfsUrl?: string;
  sqlitePath?: string;
}) {
  let config;
  let data;

  if (argv.configPath) {
    // If a `configPath` is specified, try to read it and throw error if it doesn't exist
    try {
      data = await readFile(path.resolve(untildify(argv.configPath)), 'utf8');
    } catch (error) {
      throw new Error(
        `Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point.`,
      );
    }

    try {
      config = Object.assign(JSON.parse(data), argv);
    } catch (error) {
      throw new Error(
        `Cannot parse configuration file at \`${argv.configPath}\`. Check to ensure that it is valid JSON.`,
      );
    }
  } else if (argv.gtfsPath || argv.gtfsUrl || argv.sqlitePath) {
    // Use argv values from CLI
    const agencies = [];
    if (argv.gtfsPath) {
      agencies.push({
        path: argv.gtfsPath,
      });
    }

    if (argv.gtfsUrl) {
      agencies.push({
        url: argv.gtfsUrl,
      });
    }

    config = {
      agencies,
      ...omit(argv, ['path', 'url']),
    };
  } else if (existsSync(path.resolve('./config.json'))) {
    // Else if `config.json` exists, use config values read from it
    try {
      data = await readFile(path.resolve('./config.json'), 'utf8');
    } catch (error) {
      throw new Error(
        `Cannot open configuration file at \`${path.resolve('./config.json')}\`. Check to ensure that it exists. Use config-sample.json as a starting point.`,
      );
    }

    try {
      config = Object.assign(JSON.parse(data), argv);
      console.log('Using configuration from ./config.json');
    } catch (error) {
      throw new Error(
        `Cannot parse configuration file at \`${path.resolve('./config.json')}\`. Check to ensure that it is valid JSON.`,
      );
    }
  } else {
    throw new Error(
      'Cannot find configuration file. Use config-sample.json as a starting point, pass --configPath option.',
    );
  }

  return config;
}

/*
 * Prepare the specified directory for saving HTML timetables by deleting
 * everything.
 */
export async function prepDirectory(exportPath: string) {
  await rm(exportPath, { recursive: true, force: true });
  await mkdir(exportPath, { recursive: true });
}

/*
 * Unzip a zipfile into a specified directory
 */
export async function unzip(zipfilePath: string, exportPath: string) {
  /* eslint-disable-next-line new-cap */
  const zip = new StreamZip.async({ file: zipfilePath });
  await zip.extract(null, exportPath);
  await zip.close();
}

/*
 * Generate a folder name based on a string.
 */
export function generateFolderName(folderName: string) {
  return snakeCase(sanitize(folderName));
}
