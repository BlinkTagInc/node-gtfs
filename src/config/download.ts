import { readConfigStringMap, readConfigNumber } from './readers.ts';
import type { ConfigValidationContext } from './validation.ts';

export function resolveDownloadOptions({
  value,
  path,
  context,
  defaults,
}: {
  value: Readonly<Record<string, unknown>>;
  path: string;
  context: ConfigValidationContext;
  defaults: Readonly<{
    requestHeaders: Readonly<Record<string, string>>;
    timeoutMs: number;
  }>;
}): Readonly<{
  requestHeaders: Readonly<Record<string, string>>;
  timeoutMs: number;
}> {
  return Object.freeze({
    requestHeaders: readConfigStringMap(
      value.requestHeaders === undefined
        ? defaults.requestHeaders
        : value.requestHeaders,
      `${path}.requestHeaders`,
      context,
    ),
    timeoutMs: readConfigNumber(
      value.timeoutMs,
      `${path}.timeoutMs`,
      context,
      defaults.timeoutMs,
      { integer: true, range: 'positive' },
    ),
  });
}
