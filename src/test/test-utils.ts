/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  before,
  after,
  beforeEach as nodeBeforeEach,
  afterEach as nodeAfterEach,
} from 'node:test';
import assert from 'node:assert';

// Jest-like expect function
export function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected);
    },
    toHaveLength(expected: number) {
      assert.strictEqual(actual.length, expected);
    },
    toContain(expected: any) {
      assert.ok(
        actual.includes(expected),
        `Expected ${actual} to contain ${expected}`,
      );
    },
    toNotContain(expected: any) {
      assert.ok(
        !actual.includes(expected),
        `Expected ${actual} to not contain ${expected}`,
      );
    },
    toContainEqual(expected: any) {
      const found = actual.some((item: any) => {
        try {
          assert.deepStrictEqual(item, expected);
          return true;
        } catch {
          return false;
        }
      });
      assert.ok(
        found,
        `Expected ${JSON.stringify(actual)} to contain equal to ${JSON.stringify(expected)}`,
      );
    },
    toNotContainEqual(expected: any) {
      const found = actual.some((item: any) => {
        try {
          assert.deepStrictEqual(item, expected);
          return true;
        } catch {
          return false;
        }
      });
      assert.ok(
        !found,
        `Expected ${JSON.stringify(actual)} to not contain equal to ${JSON.stringify(expected)}`,
      );
    },
    toMatch(expected: any) {
      if (typeof expected === 'string') {
        assert.ok(
          actual.includes(expected),
          `Expected ${actual} to match ${expected}`,
        );
      } else if (expected instanceof RegExp) {
        assert.ok(
          expected.test(actual),
          `Expected ${actual} to match ${expected}`,
        );
      } else {
        assert.fail(`Expected ${actual} to match ${expected}`);
      }
    },
    toBeGreaterThan(expected: number) {
      assert.ok(
        actual > expected,
        `Expected ${actual} to be greater than ${expected}`,
      );
    },
    toBeDefined() {
      assert.ok(actual !== undefined, 'Expected value to be defined');
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    toBeTruthy() {
      assert.ok(actual, 'Expected value to be truthy');
    },
    toBeFalsy() {
      assert.ok(!actual, 'Expected value to be falsy');
    },
    toThrow(expectedError?: any) {
      if (typeof actual === 'function') {
        try {
          actual();
          assert.fail('Expected function to throw');
        } catch (error: any) {
          if (expectedError) {
            if (typeof expectedError === 'string') {
              assert.ok(error.message.includes(expectedError));
            } else if (expectedError && typeof expectedError === 'function') {
              assert.ok(error instanceof expectedError);
            }
          }
        }
      } else {
        assert.fail('Expected a function');
      }
    },
  };
}

// Re-export node:test functions
export { describe, it };

// Jest-like beforeAll function
export function beforeAll(fn: () => void | Promise<void>) {
  return before(fn);
}

// Jest-like afterAll function
export function afterAll(fn: () => void | Promise<void>) {
  return after(fn);
}

// Jest-like beforeEach function
export function beforeEach(fn: () => void | Promise<void>) {
  return nodeBeforeEach(fn);
}

// Jest-like afterEach function
export function afterEach(fn: () => void | Promise<void>) {
  return nodeAfterEach(fn);
}
