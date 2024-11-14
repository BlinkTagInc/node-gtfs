import { clearLine, cursorTo } from 'node:readline';
import { noop } from 'lodash-es';
import * as colors from 'yoctocolors';
import { Config } from '../types/global_interfaces.ts';

/** Function type for logging with optional line overwrite */
type LogFunction = (text: string, overwrite?: boolean) => void;

/**
 * Creates a logging function based on configuration settings
 * @param {Config} config - Configuration object containing logging preferences
 * @returns {LogFunction} Logging function that writes to stdout, or noop if verbose is false
 * @example
 * const logger = log({ verbose: true });
 * logger('Processing...', true); // Overwrites current line
 * logger('Done!'); // Writes on new line
 */
export function log(config: Config): LogFunction {
  if (config.verbose === false) {
    return noop;
  }

  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string, overwrite = false): void => {
    if (overwrite && process.stdout.isTTY) {
      clearLine(process.stdout, 0);
      cursorTo(process.stdout, 0);
    } else {
      process.stdout.write('\n');
    }

    process.stdout.write(text);
  };
}

/**
 * Creates a warning logging function
 * @param {Config} config - Configuration object containing logging preferences
 * @returns {(text: string) => void} Function that logs formatted warning messages
 * @example
 * const warnLogger = logWarning(config);
 * warnLogger('Resource not found'); // Outputs yellow warning message
 */
export function logWarning(config: Config): (text: string) => void {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string): void => {
    process.stdout.write(`\n${formatWarning(text)}\n`);
  };
}

/**
 * Creates an error logging function
 * @param {Config} config - Configuration object containing logging preferences
 * @returns {(text: string) => void} Function that logs formatted error messages
 * @example
 * const errorLogger = logError(config);
 * errorLogger('Failed to connect'); // Outputs red error message
 */
export function logError(config: Config): (text: string) => void {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string): void => {
    process.stdout.write(`\n${formatError(text)}\n`);
  };
}

/**
 * Formats warning text with yellow color and underline
 * @param {string} text - The warning message to format
 * @returns {string} Formatted warning message in yellow with underlined "Warning" prefix
 * @example
 * const formattedWarning = formatWarning('Resource not found');
 * console.log(formattedWarning); // Yellow "Warning: Resource not found"
 */
export function formatWarning(text: string): string {
  return colors.yellow(`${colors.underline('Warning')}: ${text}`);
}

/**
 * Formats error text with red color and underline
 * @param {Error | string} error - The error object or message to format
 * @returns {string} Formatted error message in red with underlined "Error" prefix
 * @example
 * const formattedError = formatError(new Error('Connection failed'));
 * console.log(formattedError); // Red "Error: Connection failed"
 */
export function formatError(error: Error | string): string {
  const messageText = error instanceof Error ? error.message : error;
  const cleanMessage = messageText.replace(/^Error:\s*/i, '');

  return colors.red(`${colors.underline('Error')}: ${cleanMessage}`);
}
