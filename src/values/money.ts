import { ISO_4217_MINOR_UNITS } from '../data/iso-4217-minor-units.ts';

const SIGNED_64_MIN = -(2n ** 63n);
const SIGNED_64_MAX = 2n ** 63n - 1n;
const DECIMAL_PATTERN = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/;

export class GtfsMoneyError extends TypeError {}

/** Returns the pinned ISO 4217 minor-unit exponent for a currency code. */
export function getCurrencyMinorUnit(currency: unknown): number {
  if (typeof currency !== 'string' || currency.length !== 3) {
    throw new GtfsMoneyError(
      'A three-letter ISO 4217 currency code is required',
    );
  }
  const exponent = ISO_4217_MINOR_UNITS[currency];
  if (exponent === undefined) {
    throw new GtfsMoneyError(
      `Currency ${currency} has no supported ISO 4217 minor-unit exponent`,
    );
  }
  return exponent;
}

/** Converts a source decimal token to exact signed 64-bit minor units. */
export function decimalStringToMinorUnits(
  decimal: string,
  currency: unknown,
): bigint {
  const exponent = getCurrencyMinorUnit(currency);
  const match = decimal.match(DECIMAL_PATTERN);
  if (!match) {
    throw new GtfsMoneyError(`Invalid decimal monetary value: ${decimal}`);
  }

  const integer = match[2] ?? '0';
  const fraction = match[3] ?? match[4] ?? '';
  if (fraction.length > exponent) {
    throw new GtfsMoneyError(
      `${decimal} has more than ${exponent} fractional digits for ${String(currency)}`,
    );
  }

  const magnitude = BigInt(`${integer}${fraction.padEnd(exponent, '0')}`);
  const minorUnits = match[1] === '-' ? -magnitude : magnitude;
  if (minorUnits < SIGNED_64_MIN || minorUnits > SIGNED_64_MAX) {
    throw new GtfsMoneyError(
      `${decimal} exceeds signed 64-bit minor-unit storage`,
    );
  }
  return minorUnits;
}

/** Formats exact stored minor units as the canonical public decimal string. */
export function minorUnitsToDecimalString(
  stored: bigint | number | string,
  currency: unknown,
): string {
  const exponent = getCurrencyMinorUnit(currency);
  let minorUnits: bigint;
  if (
    !['bigint', 'number', 'string'].includes(typeof stored) ||
    (typeof stored === 'string' && !/^[+-]?\d+$/u.test(stored))
  ) {
    throw new GtfsMoneyError(
      `Invalid stored minor-unit value: ${String(stored)}`,
    );
  }
  try {
    if (typeof stored === 'number' && !Number.isSafeInteger(stored)) {
      throw new GtfsMoneyError('Unsafe numeric minor-unit value');
    }
    minorUnits = BigInt(stored);
  } catch (error) {
    if (error instanceof GtfsMoneyError) {
      throw error;
    }
    throw new GtfsMoneyError(
      `Invalid stored minor-unit value: ${String(stored)}`,
    );
  }

  if (minorUnits < SIGNED_64_MIN || minorUnits > SIGNED_64_MAX) {
    throw new GtfsMoneyError(
      'Stored monetary value exceeds signed 64-bit range',
    );
  }

  const negative = minorUnits < 0n;
  const digits = (negative ? -minorUnits : minorUnits).toString();
  if (exponent === 0) {
    return `${negative && minorUnits !== 0n ? '-' : ''}${digits}`;
  }

  const padded = digits.padStart(exponent + 1, '0');
  const integer = padded.slice(0, -exponent);
  const fraction = padded.slice(-exponent);
  return `${negative && minorUnits !== 0n ? '-' : ''}${integer}.${fraction}`;
}
