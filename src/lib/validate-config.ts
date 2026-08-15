import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';

import type { Config } from '../types/global_interfaces.ts';

const LOG_LEVELS = ['silent', 'error', 'warning', 'info'] as const;

type KeySpec =
  | { type: 'boolean' }
  | { type: 'string' }
  | { type: 'number' }
  | { type: 'enum'; values: readonly string[] }
  | { type: 'function' }
  | { type: 'object' }
  | { type: 'array' };

const KNOWN_KEYS: Record<string, KeySpec> = {
  agencies: { type: 'array' },
  csvOptions: { type: 'object' },
  db: { type: 'object' },
  downloadTimeout: { type: 'number' },
  exportPath: { type: 'string' },
  gtfsRealtimeExpirationSeconds: { type: 'number' },
  ignoreDuplicates: { type: 'boolean' },
  ignoreErrors: { type: 'boolean' },
  includeImportReport: { type: 'boolean' },
  logFunction: { type: 'function' },
  logLevel: { type: 'enum', values: LOG_LEVELS },
  sqlitePath: { type: 'string' },
  verbose: { type: 'boolean' },
};

/*
 * Options that still work but have been replaced, with what to use instead.
 * A warning rather than an error, since the old name is still honoured.
 */
const DEPRECATED_KEYS: Record<string, string> = {
  verbose:
    '`verbose` is deprecated - use `logLevel`. `verbose: false` means `logLevel: "warning"`; use `"silent"` to suppress everything',
};

function checkType(key: string, value: unknown, spec: KeySpec): string | null {
  // Any option may be explicitly null or undefined to mean "unset".
  if (value === null || value === undefined) {
    return null;
  }

  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean'
        ? null
        : `\`${key}\` must be a boolean, got ${JSON.stringify(value)}`;
    case 'string':
      return typeof value === 'string'
        ? null
        : `\`${key}\` must be a string, got ${JSON.stringify(value)}`;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : `\`${key}\` must be a number, got ${JSON.stringify(value)}`;
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value)
        ? null
        : `\`${key}\` must be one of ${spec.values.map((enumValue) => `\`${enumValue}\``).join(', ')}, got ${JSON.stringify(value)}`;
    case 'function':
      return typeof value === 'function'
        ? null
        : `\`${key}\` must be a function`;
    case 'object':
      return typeof value === 'object' && !Array.isArray(value)
        ? null
        : `\`${key}\` must be an object, got ${JSON.stringify(value)}`;
    case 'array':
      return Array.isArray(value)
        ? null
        : `\`${key}\` must be an array, got ${JSON.stringify(value)}`;
  }
}

/*
 * How many single-character edits separate two strings, capped at `limit` so a
 * pair that is obviously unrelated stops being compared early.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) {
    return limit + 1;
  }

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }

    previous = current;
  }

  return previous[b.length];
}

/*
 * The known option an unrecognised key was probably meant to be, or null when
 * it does not look like any of them.
 *
 * node-GTFS is embedded in other tools - GTFS-to-HTML, GTFS-to-geojson and
 * others hand it their own configuration wholesale - so an unrecognised key is
 * usually somebody else's option passing through and warning about it would
 * bury the run in noise. A key one or two characters away from a real one is a
 * different matter: that is a typo, and it is silently doing nothing.
 */
function findLikelyTypo(key: string): string | null {
  const limit = key.length <= 6 ? 1 : 2;
  let best: { name: string; distance: number } | null = null;

  for (const known of Object.keys(KNOWN_KEYS)) {
    if (known === key) {
      return null;
    }

    const distance = editDistance(
      key.toLowerCase(),
      known.toLowerCase(),
      limit,
    );

    if (distance <= limit && (best === null || distance < best.distance)) {
      best = { name: known, distance };
    }
  }

  return best?.name ?? null;
}

/*
 * Validate a user-provided config object. Throws a single error listing every
 * problem found, rather than failing on the first, so a config with three
 * mistakes in it takes one run to fix rather than three.
 *
 * A misspelled option is only a warning: it may well be an option belonging to
 * whatever is calling node-GTFS, and the run can go on either way.
 */
export function validateConfig(config: Config, warn: (text: string) => void) {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(config)) {
    const spec = KNOWN_KEYS[key];

    if (spec === undefined) {
      const suggestion = findLikelyTypo(key);

      if (suggestion !== null) {
        warn(
          `Unknown configuration option \`${key}\` - did you mean \`${suggestion}\`? It is being ignored`,
        );
      }

      continue;
    }

    if (DEPRECATED_KEYS[key] !== undefined && value !== undefined) {
      warn(DEPRECATED_KEYS[key]);
    }

    const typeError = checkType(key, value, spec);

    if (typeError !== null) {
      errors.push(typeError);
    }
  }

  if (!config.agencies || config.agencies.length === 0) {
    errors.push(
      'No `agencies` specified in config - each names a GTFS to import by `url` or `path`',
    );
  }

  for (const [index, agency] of (config.agencies ?? []).entries()) {
    if (!agency || typeof agency !== 'object') {
      errors.push(
        `\`agencies[${index}]\` must be an object with a \`url\` or a \`path\``,
      );
      continue;
    }

    /*
     * `ConfigAgency` is a union requiring one of `url`/`path`, so neither can
     * be read directly. This runtime check still matters for untyped JS
     * callers.
     */
    const hasPath = 'path' in agency && agency.path;
    const hasUrl = 'url' in agency && agency.url;

    if (!hasPath && !hasUrl) {
      errors.push(
        `No agency \`url\` or \`path\` specified in config for \`agencies[${index}]\``,
      );
    }
  }

  if (errors.length > 0) {
    throw new GtfsError(
      `Invalid configuration:\n${errors.map((error) => `  - ${error}`).join('\n')}`,
      {
        code: GtfsErrorCode.GTFS_CONFIG_INVALID,
        category: GtfsErrorCategory.CONFIG,
        details: { errors },
      },
    );
  }

  return config;
}
