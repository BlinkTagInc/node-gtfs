import assert from 'node:assert/strict';

import {
  decimalStringToMinorUnits,
  getCurrencyMinorUnit,
  GtfsMoneyError,
  minorUnitsToDecimalString,
} from '../../src/values/money.ts';
import { describe, it } from 'node:test';

describe('portable monetary values', () => {
  it('rejects invalid decimal syntax without coercion', () => {
    for (const value of [
      '',
      ' ',
      ' 1',
      '1 ',
      '1\n',
      '1e2',
      '0x10',
      'NaN',
      'Infinity',
      '1,000',
      '$1',
      '.',
      '+',
      '--1',
      '1.2.3',
    ]) {
      assert.throws(
        () => decimalStringToMinorUnits(value, 'USD'),
        (error: unknown) => {
          assert.ok(error instanceof GtfsMoneyError);
          assert.equal(
            error.message,
            `Invalid decimal monetary value: ${value}`,
          );
          return true;
        },
      );
    }
  });

  it('rejects unsafe numeric minor units', () => {
    for (const value of [
      NaN,
      Infinity,
      -Infinity,
      1.5,
      -0.5,
      Number.MAX_SAFE_INTEGER + 1,
      Number.MIN_SAFE_INTEGER - 1,
    ]) {
      assert.throws(() => minorUnitsToDecimalString(value, 'USD'), {
        name: 'TypeError',
        message: 'Unsafe numeric minor-unit value',
      });
    }
    assert.equal(
      minorUnitsToDecimalString(Number.MAX_SAFE_INTEGER, 'USD'),
      '90071992547409.91',
    );
    assert.equal(
      minorUnitsToDecimalString(Number.MIN_SAFE_INTEGER, 'USD'),
      '-90071992547409.91',
    );
  });

  it('rejects malformed stored integer values', () => {
    for (const value of [
      '',
      ' ',
      '0x10',
      '1e2',
      '1.5',
      '--1',
      'NaN',
      null,
      undefined,
      true,
      [],
      {},
    ]) {
      assert.throws(
        () => minorUnitsToDecimalString(value as never, 'USD'),
        (error: unknown) => {
          assert.ok(error instanceof GtfsMoneyError);
          assert.equal(
            error.message,
            `Invalid stored minor-unit value: ${String(value)}`,
          );
          return true;
        },
      );
    }
  });

  it('rejects overflow in both directions for decimal and stored values', () => {
    for (const value of ['92233720368547758.08', '-92233720368547758.09']) {
      assert.throws(() => decimalStringToMinorUnits(value, 'USD'), {
        message: `${value} exceeds signed 64-bit minor-unit storage`,
      });
    }
    for (const value of [9223372036854775808n, -9223372036854775809n]) {
      for (const stored of [value, String(value)]) {
        assert.throws(() => minorUnitsToDecimalString(stored, 'USD'), {
          message: 'Stored monetary value exceeds signed 64-bit range',
        });
      }
    }
    for (const stored of ['9223372036854775807', '-9223372036854775808']) {
      assert.equal(
        decimalStringToMinorUnits(
          minorUnitsToDecimalString(stored, 'USD'),
          'USD',
        ),
        BigInt(stored),
      );
    }
  });
  it('uses pinned ISO 4217 exponents without binary floating point', () => {
    assert.equal(getCurrencyMinorUnit('USD'), 2);
    assert.equal(getCurrencyMinorUnit('JPY'), 0);
    assert.equal(getCurrencyMinorUnit('BHD'), 3);
    assert.equal(decimalStringToMinorUnits('3.75', 'USD'), 375n);
    assert.equal(decimalStringToMinorUnits('.5', 'USD'), 50n);
    assert.equal(decimalStringToMinorUnits('-0.001', 'BHD'), -1n);
    assert.equal(minorUnitsToDecimalString(375n, 'USD'), '3.75');
    assert.equal(minorUnitsToDecimalString(10n, 'JPY'), '10');
    assert.equal(minorUnitsToDecimalString(1n, 'BHD'), '0.001');
    assert.equal(minorUnitsToDecimalString('+001', 'USD'), '0.01');
    for (const zero of [0, 0n, '0', '-0']) {
      assert.equal(minorUnitsToDecimalString(zero, 'USD'), '0.00');
    }
  });

  it('preserves the complete signed 64-bit storage range', () => {
    const maximum = decimalStringToMinorUnits('92233720368547758.07', 'USD');
    const minimum = decimalStringToMinorUnits('-92233720368547758.08', 'USD');
    assert.equal(maximum, 9_223_372_036_854_775_807n);
    assert.equal(minimum, -9_223_372_036_854_775_808n);
    assert.equal(
      minorUnitsToDecimalString(maximum, 'USD'),
      '92233720368547758.07',
    );
    assert.equal(
      minorUnitsToDecimalString(minimum, 'USD'),
      '-92233720368547758.08',
    );
  });

  it('rejects rounding, unsupported exponents, and overflow', () => {
    assert.throws(() => decimalStringToMinorUnits('1.230', 'USD'));
    assert.throws(() => decimalStringToMinorUnits('1', 'XAU'));
    assert.throws(() => decimalStringToMinorUnits('1', null));
    assert.throws(() =>
      decimalStringToMinorUnits('92233720368547758.08', 'USD'),
    );
  });
});
