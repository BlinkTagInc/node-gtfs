import { createGtfsConfigError } from '../diagnostics/errors.ts';

export function assertConfigOptionKeys<Value>(
  value: Value,
  {
    name,
    keys,
    removed = {},
  }: {
    readonly name: string;
    readonly keys: readonly string[];
    readonly removed?: Readonly<Record<string, string>>;
  },
): asserts value is Value & Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw createGtfsConfigError(
      `\`${name}\` accepts one named options object`,
      { method: name },
    );
  }
  for (const key of Object.keys(value)) {
    const replacement = Object.hasOwn(removed, key) ? removed[key] : undefined;
    if (replacement !== undefined) {
      throw createGtfsConfigError(
        `\`${key}\` was removed from \`${name}\`; use \`${replacement}\``,
        {
          method: name,
          reason: 'legacy-option',
          legacyPath: key,
          replacementPath: replacement,
        },
      );
    }
    if (!keys.includes(key)) {
      throw createGtfsConfigError(
        `Unknown \`${name}\` option ${JSON.stringify(key)}`,
        { method: name, reason: 'unknown-option', path: key },
      );
    }
  }
}

export function isPlainObject<Value>(
  value: Value,
): value is Value & Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isNonNegativeNumber(
  value: unknown,
  options: { readonly integer?: boolean; readonly positive?: boolean } = {},
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (options.positive ? value > 0 : value >= 0) &&
    (!options.integer || Number.isSafeInteger(value))
  );
}
