const path = require('path');
const fs = require('fs-extra');
const untildify = require('untildify');

/*
 * Attempt to parse the specified config JSON file.
 */
exports.getConfig = async argv => {
  try {
    const data = await fs.readFile(path.resolve(untildify(argv.configPath)), 'utf8');
    const config = JSON.parse(data);

    if (argv.skipDelete) {
      config.skipDelete = argv.skipDelete;
    }

    return config;
  } catch (error) {
    console.error(new Error(`Cannot find configuration file at \`${argv.configPath}\`. Use config-sample.json as a starting point, pass --configPath option`));
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
