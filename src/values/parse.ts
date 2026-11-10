import type { CompiledGtfsColumn } from '../schema/compile-table.ts';
import { parseGtfsTime } from './service-time.ts';
import { decimalStringToMinorUnits } from './money.ts';

export type GtfsPrimitiveParseResult =
  | {
      readonly valid: true;
      readonly value: string | number | bigint;
      readonly serviceDaySeconds?: number;
    }
  | {
      readonly valid: false;
      readonly reason:
        | 'invalid-integer'
        | 'unsafe-integer'
        | 'invalid-real'
        | 'invalid-date'
        | 'invalid-time'
        | 'invalid-json'
        | 'invalid-money';
    };

/** Parses a nonempty field; callers handle presence, defaults, and diagnostics. */
export function parseGtfsPrimitiveValue(
  value: unknown,
  column: CompiledGtfsColumn,
  row: Readonly<Record<string, unknown>>,
): GtfsPrimitiveParseResult {
  if (column.monetary) {
    try {
      return {
        valid: true,
        value: decimalStringToMinorUnits(
          String(value),
          row[column.monetary.currencyField],
        ),
      };
    } catch {
      return { valid: false, reason: 'invalid-money' };
    }
  }

  if (column.valueKind === 'integer') {
    if (
      typeof value === 'number'
        ? !Number.isInteger(value)
        : !/^[+-]?\d+$/.test(String(value))
    ) {
      return { valid: false, reason: 'invalid-integer' };
    }
    const integer = Number(value);
    return Number.isSafeInteger(integer)
      ? { valid: true, value: integer }
      : { valid: false, reason: 'unsafe-integer' };
  }

  if (column.valueKind === 'real') {
    const real = Number(value);
    return Number.isFinite(real)
      ? { valid: true, value: real }
      : { valid: false, reason: 'invalid-real' };
  }

  if (column.valueKind === 'date') {
    const compact = String(value).replaceAll('-', '');
    return /^\d{8}$/.test(compact)
      ? { valid: true, value: Number(compact) }
      : { valid: false, reason: 'invalid-date' };
  }

  if (column.valueKind === 'time') {
    const time = parseGtfsTime(String(value));
    return time === null
      ? { valid: false, reason: 'invalid-time' }
      : {
          valid: true,
          value: time.normalized,
          serviceDaySeconds: time.serviceDaySeconds,
        };
  }

  if (column.valueKind === 'json') {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      const serialized = JSON.stringify(parsed);
      return serialized === undefined
        ? { valid: false, reason: 'invalid-json' }
        : { valid: true, value: serialized };
    } catch {
      return { valid: false, reason: 'invalid-json' };
    }
  }

  return { valid: true, value: String(value) };
}
