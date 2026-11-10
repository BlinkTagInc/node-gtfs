import { isPlainObject, isNonNegativeNumber } from './options.ts';
import { isLegacyConfigPath } from './legacy-diagnostics.ts';
import {
  addConfigIssue,
  formatConfigPath,
  type ConfigValidationContext,
} from './validation.ts';

function getEditDistanceCell(values: readonly number[], index: number): number {
  const value = values.at(index);
  if (value === undefined) {
    throw new RangeError(`Missing edit-distance cell at index ${index}`);
  }
  return value;
}

function editDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) {
    return limit + 1;
  }
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        getEditDistanceCell(previous, rightIndex) + 1,
        getEditDistanceCell(current, rightIndex - 1) + 1,
        getEditDistanceCell(previous, rightIndex - 1) +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return getEditDistanceCell(previous, right.length);
}

function findLikelyConfigTypo(
  key: string,
  knownKeys: readonly string[],
): string | null {
  const limit = key.length <= 6 ? 1 : 2;
  let best: { key: string; distance: number } | undefined;
  for (const knownKey of knownKeys) {
    const distance = editDistance(
      key.toLowerCase(),
      knownKey.toLowerCase(),
      limit,
    );
    if (distance <= limit && (!best || distance < best.distance)) {
      best = { key: knownKey, distance };
    }
  }
  return best?.key ?? null;
}

export function validateKnownConfigKeys(
  value: Record<string, unknown>,
  path: string,
  knownKeys: readonly string[],
  context: ConfigValidationContext,
): void {
  for (const key of Object.keys(value)) {
    if (knownKeys.includes(key)) {
      continue;
    }
    const fullPath = formatConfigPath(path, key);
    if (isLegacyConfigPath(fullPath)) {
      continue;
    }
    const suggestion = findLikelyConfigTypo(key, knownKeys);
    context.issues.push({
      reason: 'unknown-option',
      path: fullPath,
      ...(suggestion ? { suggestion: formatConfigPath(path, suggestion) } : {}),
      message: suggestion
        ? `Unknown configuration option \`${fullPath}\`; did you mean \`${formatConfigPath(path, suggestion)}\`?`
        : `Unknown configuration option \`${fullPath}\``,
    });
  }
}

export function readConfigObject(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
  required = false,
): Record<string, unknown> | undefined {
  if (value === undefined) {
    if (required) {
      addConfigIssue(
        context,
        'missing-value',
        path,
        `Configuration option \`${path}\` is required`,
      );
    }
    return undefined;
  }
  if (!isPlainObject(value)) {
    addConfigIssue(
      context,
      'invalid-type',
      path,
      `Configuration option \`${path}\` must be an object`,
    );
    return undefined;
  }
  return value;
}

export function readConfigString(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
  required = false,
): string | undefined {
  if (value === undefined) {
    if (required) {
      addConfigIssue(
        context,
        'missing-value',
        path,
        `Configuration option \`${path}\` is required`,
      );
    }
    return undefined;
  }
  if (typeof value !== 'string' || (required && value.trim() === '')) {
    addConfigIssue(
      context,
      'invalid-type',
      path,
      `Configuration option \`${path}\` must be ${required ? 'a non-empty string' : 'a string'}`,
    );
    return undefined;
  }
  return value;
}

export function readConfigStringMap(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
): Readonly<Record<string, string>> {
  if (value === undefined) {
    return Object.freeze({});
  }
  const object = readConfigObject(value, path, context);
  if (!object) {
    return Object.freeze({});
  }
  const result: Record<string, string> = {};
  for (const [name, headerValue] of Object.entries(object)) {
    if (typeof headerValue !== 'string') {
      addConfigIssue(
        context,
        'invalid-type',
        `${path}.${name}`,
        `Configuration option \`${path}.${name}\` must be a string`,
      );
    } else {
      result[name] = headerValue;
    }
  }
  return Object.freeze(result);
}

export function readConfigBoolean(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'boolean') {
    addConfigIssue(
      context,
      'invalid-type',
      path,
      `Configuration option \`${path}\` must be a boolean`,
    );
    return defaultValue;
  }
  return value;
}

export function readConfigNumber(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
  defaultValue: number,
  constraints: {
    readonly integer: boolean;
    readonly range: 'positive' | 'non-negative';
  },
): number {
  if (value === undefined) {
    return defaultValue;
  }
  const valid = isNonNegativeNumber(value, {
    integer: constraints.integer,
    positive: constraints.range === 'positive',
  });
  if (!valid) {
    addConfigIssue(
      context,
      'invalid-value',
      path,
      `Configuration option \`${path}\` must be a ${constraints.range}${constraints.integer ? ' safe integer' : ' number'}`,
    );
    return defaultValue;
  }
  return value;
}

export function readConfigEnum<Value extends string>(
  value: unknown,
  path: string,
  context: ConfigValidationContext,
  values: readonly Value[],
  defaultValue: Value,
): Value {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'string' || !values.includes(value as Value)) {
    addConfigIssue(
      context,
      'invalid-value',
      path,
      `Configuration option \`${path}\` must be one of ${values.map((item) => JSON.stringify(item)).join(', ')}`,
    );
    return defaultValue;
  }
  return value as Value;
}
