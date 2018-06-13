const readline = require('readline');

const _ = require('lodash');
const colors = require('colors');

/*
 * Returns a log function based on config settings
 */
exports.log = config => {
  if (config.verbose === false) {
    return _.noop;
  }

  return (text, overwrite) => {
    if (overwrite === true) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
    } else {
      process.stdout.write('\n');
    }
    process.stdout.write(text);
  };
};

/*
 * Function to print a warning to the console
 */
exports.warn = text => {
  process.stdout.write(`\n${colors.yellow.underline('Warning')}${colors.yellow(':')} ${colors.yellow(text)}\n`);
};

/*
 * Function to print an error to the console
 */
exports.error = text => {
  process.stdout.write(`\n${colors.red.underline('Error')}${colors.yellow(':')} ${colors.red(text)}\n`);
};
