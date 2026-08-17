import { GtfsError, GtfsErrorCategory, GtfsErrorCode } from './errors.ts';

import type { GtfsImportConfig, GtfsRealtimeConfig } from '../types/config.ts';

type ValidatableConfig = GtfsImportConfig | GtfsRealtimeConfig;

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

/* Deprecated options and their replacements. */
const DEPRECATED_KEYS: Record<string, string> = {
  verbose:
    '`verbose` is deprecated - use `logLevel`. `verbose: false` means `logLevel: "warning"`; use `"silent"` to suppress everything',
};

function checkType(key: string, value: unknown, spec: KeySpec): string | null {
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

// Embedding tools may add options, so only likely misspellings produce warnings.
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

/** Validates configuration and reports likely misspellings through `warn`. */
export function validateConfig(
  config: ValidatableConfig,
  warn: (text: string) => void,
  options: { requireStaticSource?: boolean } = { requireStaticSource: true },
) {
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

    const hasPath = 'path' in agency && Boolean(agency.path);
    const hasUrl = 'url' in agency && Boolean(agency.url);

    if (options.requireStaticSource && !hasPath && !hasUrl) {
      errors.push(
        `No agency \`url\` or \`path\` specified in config for \`agencies[${index}]\``,
      );
    }

    if (hasPath && hasUrl) {
      errors.push(
        `Only one of \`url\` or \`path\` may be specified for \`agencies[${index}]\``,
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
