import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readConfigNumber } from '../../src/config/readers.ts';
import type { ConfigValidationContext } from '../../src/config/validation.ts';
import { configIssueDetails } from '../helpers/config-issues.ts';

for (const { constraints, valid, invalid } of [
  {
    constraints: { integer: true, range: 'positive' },
    valid: [1, Number.MAX_SAFE_INTEGER],
    invalid: [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1],
  },
  {
    constraints: { integer: true, range: 'non-negative' },
    valid: [0, 1, Number.MAX_SAFE_INTEGER],
    invalid: [-1, 0.5, Number.MAX_SAFE_INTEGER + 1],
  },
  {
    constraints: { integer: false, range: 'positive' },
    valid: [0.5, 1],
    invalid: [0, -0.5, -1],
  },
  {
    constraints: { integer: false, range: 'non-negative' },
    valid: [0, 0.5, 1],
    invalid: [-0.5, -1],
  },
] as const) {
  test(`config number reader enforces explicit ${constraints.range} ${constraints.integer ? 'safe-integer' : 'number'} constraints`, () => {
    const context: ConfigValidationContext = {
      format: 'javascript',
      operation: 'instance',
      issues: [],
    };
    assert.equal(
      readConfigNumber(undefined, 'setting', context, 10, constraints),
      10,
    );
    for (const value of valid) {
      assert.equal(
        readConfigNumber(value, 'setting', context, 10, constraints),
        value,
      );
    }
    assert.deepEqual(context.issues, []);
    for (const value of [
      ...invalid,
      NaN,
      Infinity,
      -Infinity,
      null,
      '1',
      true,
      [],
      {},
    ]) {
      const previousCount: number = context.issues.length;
      assert.equal(
        readConfigNumber(value, 'setting', context, 10, constraints),
        10,
      );
      assert.equal(context.issues.length, previousCount + 1);
      assert.deepEqual(configIssueDetails(context.issues).at(-1), {
        reason: 'invalid-value',
        path: 'setting',
      });
    }
  });
}
