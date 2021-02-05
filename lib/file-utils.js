const path = require('path');
const fs = require('fs-extra');
const { snakeCase } = require('lodash');
const sanitize = require('sanitize-filename');
const untildify = require('untildify');
const unzipper = require('unzipper');

/*
 * Attempt to parse the specified config JSON file.
 */
exports.getConfig = async argv => {
  try {
    const data = await fs.readFile(path.resolve(untildify(argv.configPath)), 'utf8').catch(error => {
      console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
      throw error;
    });
    const config = JSON.parse(data);

    return config;
  } catch (error) {
    console.error(new Error(`Cannot parse configuration file at \`${argv.configPath}\`. Check to ensure that it is valid JSON.`));
    throw error;
  }
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
