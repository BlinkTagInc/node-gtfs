const path = require('path');
const fs = require('fs-extra');
const { omit, snakeCase } = require('lodash');
const sanitize = require('sanitize-filename');
const untildify = require('untildify');
const unzipper = require('unzipper');

/*
 * Attempt to parse any config JSON file and read values from CLI.
 */
exports.getConfig = async argv => {
  let config;

  if (argv.configPath) {
    // If a `configPath` is specified, try to read it and throw error if it doesn't exist
    try {
      const data = await fs.readFile(path.resolve(untildify(argv.configPath)), 'utf8').catch(error => {
        console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
        throw error;
      });
      config = Object.assign(JSON.parse(data), argv);
    } catch (error) {
      console.error(new Error(`Cannot parse configuration file at \`${argv.configPath}\`. Check to ensure that it is valid JSON.`));
      throw error;
    }
  } else if (fs.existsSync(path.resolve('./config.json'))) {
    // Else if `config.json` exists, use config values read from it
    try {
      const data = await fs.readFile(path.resolve('./config.json'), 'utf8');
      config = Object.assign(JSON.parse(data), argv);
      console.log('Using configuration from ./config.json');
    } catch (error) {
      console.error(new Error('Cannot parse configuration file at `./config.json`. Check to ensure that it is valid JSON.'));
      throw error;
    }
  } else {
    // Use argv values from CLI
    const agencies = [];
    if (argv.gtfsPath) {
      agencies.push({
        path: argv.gtfsPath
      });
    }

    if (argv.gtfsUrl) {
      agencies.push({
        url: argv.gtfsUrl
      });
    }

    config = {
      agencies,
      ...omit(argv, ['path', 'url'])
    };
  }

  return config;
};

/*
 * Prepare the specified directory for saving HTML timetables by deleting
 * everything.
 */
exports.prepDirectory = async exportPath => {
  await fs.remove(exportPath);
  await fs.ensureDir(exportPath);
};

/*
 * Unzip a zipfile into a specified directory
 */
exports.unzip = (zipfilePath, exportPath) => {
  /* eslint-disable new-cap */
  return fs.createReadStream(zipfilePath)
    .pipe(unzipper.Extract({ path: exportPath }))
    .on('entry', entry => entry.autodrain())
    .promise();
  /* eslint-enable new-cap */
};

/*
 * Generate a folder name based on a string.
 */
exports.generateFolderName = folderName => snakeCase(sanitize(folderName));
