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
import path from 'node:path';
import { createReadStream, existsSync, mkdtempSync } from 'node:fs';
import { cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { parse } from 'csv-parse';

import {
  openDb,
  closeDb,
  importGtfs,
  prepDirectory,
  unzip,
} from '../../dist/index.js';
import { gtfsManifest } from '../../dist/schema/index.js';
import testConfig from './test-config.ts';

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
    toBeCloseTo(expected: number, precision = 2) {
      const tolerance = 10 ** -precision / 2;
      assert.ok(
        Math.abs(actual - expected) < tolerance,
        `Expected ${actual} to be close to ${expected} (precision ${precision}, tolerance ${tolerance})`,
      );
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

/**
 * Counts data rows in a CSV file, resolving only once parsing has finished.
 *
 * `stream.pipe(parser)` returns the parser rather than a promise, so awaiting
 * it directly resolves immediately and leaves assertions running after the
 * test has already completed. Always await this helper instead.
 *
 * @param filePath Path to the CSV file to count
 * @returns Number of data rows, or 0 when the file does not exist
 */
export async function countCsvRows(filePath: string): Promise<number> {
  if (!existsSync(filePath)) {
    return 0;
  }

  const parser = createReadStream(filePath).pipe(
    parse({
      columns: true,
      relax_quotes: true,
      trim: true,
      skip_empty_lines: true,
    }),
  );

  let rowCount = 0;
  for await (const _row of parser) {
    rowCount++;
  }

  return rowCount;
}

/**
 * Counts data rows for every file-backed GTFS table in an unzipped feed.
 *
 * @param directory Directory holding the unzipped GTFS files
 * @returns Row counts keyed by table name, 0 for absent optional files
 */
export async function countGtfsRows(
  directory: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  await Promise.all(
    Object.entries(gtfsManifest).map(async ([tableName, definition]) => {
      if (definition.file === null) return;
      counts[tableName] = await countCsvRows(
        path.join(directory, definition.file),
      );
    }),
  );

  return counts;
}

/**
 * Registers the standard import-once fixture lifecycle for a test file.
 *
 * Imports the Caltrain fixture into a fresh in-memory database before the
 * file's tests run and closes it afterwards.
 */
export function withGtfsFixture(): void {
  before(async () => {
    openDb();
    await importGtfs(testConfig);
  });

  after(() => {
    closeDb(openDb());
  });
}

/** Directory holding the hand-written feed that populates every column. */
export const completeFixturePath = 'src/test/fixture/complete';

/** A temporary feed directory and the cleanup that removes it. */
export interface FeedFixture {
  /** Directory to point an agency config at. */
  path: string;
  /** Removes the temporary directory. */
  cleanup: () => Promise<void>;
}

/**
 * Materializes a GTFS feed in a temporary directory.
 *
 * Replaces the unzip-then-overwrite boilerplate that tests needing a file the
 * base fixture lacks would otherwise repeat.
 *
 * @param options.base Feed to start from, defaulting to the Caltrain zip;
 *   `none` begins with an empty directory
 * @param options.extraFiles File contents to add or overwrite, keyed by filename
 * @returns The feed directory and its cleanup function
 */
export async function createFeedFixture(options?: {
  base?: 'caltrain' | 'complete' | 'none';
  extraFiles?: Record<string, string>;
}): Promise<FeedFixture> {
  const directory = mkdtempSync(path.join(tmpdir(), 'gtfs-fixture-'));
  await prepDirectory(directory);

  const base = options?.base ?? 'caltrain';
  if (base === 'complete') {
    await cp(completeFixturePath, directory, { recursive: true });
  } else if (base === 'caltrain') {
    await unzip(testConfig.agencies[0].path, directory);
  }

  for (const [filename, contents] of Object.entries(
    options?.extraFiles ?? {},
  )) {
    await writeFile(path.join(directory, filename), contents);
  }

  return {
    path: directory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
