import packageJson from '../package.json' with { type: 'json' };

/*
 * The version of node-GTFS that is running. Reported by `--version`.
 */
export const version = packageJson.version;
