const path = require('path');
const fs = require('fs-extra');
const untildify = require('untildify');

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
