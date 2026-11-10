import type { GtfsCsvParseOptions } from '../types/config.ts';
import { DEFAULT_GTFS_SCHEDULE_CONFIG } from './defaults.ts';
import {
  readConfigBoolean,
  readConfigEnum,
  readConfigObject,
  validateKnownConfigKeys,
} from './readers.ts';
import { addConfigIssue, type ConfigValidationContext } from './validation.ts';

const CSV_KEYS = [
  'encoding',
  'delimiter',
  'quote',
  'escape',
  'trim',
  'skipEmptyLines',
  'relaxQuotes',
] as const satisfies readonly (keyof GtfsCsvParseOptions)[];

const UNSUPPORTED_CSV_OPTIONS: Readonly<Record<string, string>> = {
  bom: 'byte-order marks are always recognized; remove this option',
  parseOptions: 'set CSV options directly on the enclosing `csv` object',
  columns: 'field names must come from the file header',
  objname: 'records must be objects keyed by field name',
  groupColumnsByName: 'each field must contain one string value',
  info: 'record-position metadata is managed by node-GTFS',
  raw: 'raw record output is not supported',
  cast: 'field conversion is managed by node-GTFS',
  castDate: 'field conversion is managed by node-GTFS',
  autoParse: 'field conversion is managed by node-GTFS',
  autoParseDate: 'field conversion is managed by node-GTFS',
  onRecord:
    'CSV callbacks are not supported; preprocess the feed before importing',
  onSkip:
    'CSV callbacks are not supported; preprocess the feed before importing',
  relaxColumnCount: 'records must have the same number of fields as the header',
  relaxColumnCountLess:
    'records must have the same number of fields as the header',
  relaxColumnCountMore: 'extra fields must not be silently discarded',
  ignoreLastDelimiters: 'extra delimiters must not be silently discarded',
  skipRecordsWithEmptyValues: 'record validation is managed by node-GTFS',
  skipRecordsWithError: 'malformed CSV records must not be silently skipped',
  from: 'partial-file imports are not supported',
  fromLine: 'partial-file imports are not supported',
  to: 'partial-file imports are not supported',
  toLine: 'partial-file imports are not supported',
  recordDelimiter: 'line endings are detected automatically',
  delimiterAuto:
    'set the `sources[].schedule.import.csv.delimiter` configuration option explicitly for non-comma-separated files',
  comment:
    'comment filtering is not supported; preprocess the feed before importing',
  commentNoInfix:
    'comment filtering is not supported; preprocess the feed before importing',
};

function readCsvCharacter(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
  defaultValue: string,
): string {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'string' || !/^[^\r\n\0\uD800-\uDFFF]$/u.test(value)) {
    addConfigIssue(
      context,
      'invalid-value',
      path,
      `Configuration option \`${path}\` must be one character other than a line break or NUL`,
    );
    return defaultValue;
  }
  return value;
}

export function resolveCsvParseOptions(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
): Required<GtfsCsvParseOptions> {
  const defaults = DEFAULT_GTFS_SCHEDULE_CONFIG.import.csv;
  const options = readConfigObject(value, path, context) ?? {};
  const recognizedKeys: string[] = [...CSV_KEYS];
  for (const key of Object.keys(options)) {
    const canonicalKey = key.replace(/_([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    const reason = Object.hasOwn(UNSUPPORTED_CSV_OPTIONS, canonicalKey)
      ? UNSUPPORTED_CSV_OPTIONS[canonicalKey]
      : undefined;
    if (reason !== undefined) {
      recognizedKeys.push(key);
      addConfigIssue(
        context,
        'unknown-option',
        `${path}.${key}`,
        `Unsupported CSV configuration option \`${path}.${key}\`; ${reason}`,
      );
    } else if (
      key !== canonicalKey &&
      CSV_KEYS.some((name) => name === canonicalKey)
    ) {
      recognizedKeys.push(key);
      context.issues.push({
        reason: 'unknown-option',
        path: `${path}.${key}`,
        suggestion: `${path}.${canonicalKey}`,
        message: `Unsupported CSV configuration option \`${path}.${key}\`; use \`${path}.${canonicalKey}\``,
      });
    }
  }
  validateKnownConfigKeys(options, path, recognizedKeys, context);

  const encoding = readConfigEnum(
    options.encoding,
    `${path}.encoding`,
    context,
    ['utf8', 'utf16le', 'latin1'],
    defaults.encoding,
  );
  const delimiter = readCsvCharacter(
    options.delimiter,
    `${path}.delimiter`,
    context,
    defaults.delimiter,
  );
  const quote =
    options.quote === false
      ? false
      : readCsvCharacter(
          options.quote,
          `${path}.quote`,
          context,
          defaults.quote,
        );
  const escape = readCsvCharacter(
    options.escape,
    `${path}.escape`,
    context,
    defaults.escape,
  );
  if (delimiter === quote) {
    addConfigIssue(
      context,
      'invalid-combination',
      `${path}.delimiter`,
      `Configuration option \`${path}.delimiter\` must differ from \`${path}.quote\``,
    );
  }
  if (encoding === 'latin1') {
    for (const [key, character] of [
      ['delimiter', delimiter],
      ['quote', quote],
      ['escape', escape],
    ] as const) {
      if (
        typeof character === 'string' &&
        Buffer.from(character, encoding).toString(encoding) !== character
      ) {
        addConfigIssue(
          context,
          'invalid-combination',
          `${path}.${key}`,
          `Configuration option \`${path}.${key}\` must be representable in ${encoding}`,
        );
      }
    }
  }
  return Object.freeze({
    encoding,
    delimiter,
    quote,
    escape,
    trim: readConfigBoolean(
      options.trim,
      `${path}.trim`,
      context,
      defaults.trim,
    ),
    skipEmptyLines: readConfigBoolean(
      options.skipEmptyLines,
      `${path}.skipEmptyLines`,
      context,
      defaults.skipEmptyLines,
    ),
    relaxQuotes: readConfigBoolean(
      options.relaxQuotes,
      `${path}.relaxQuotes`,
      context,
      defaults.relaxQuotes,
    ),
  });
}
