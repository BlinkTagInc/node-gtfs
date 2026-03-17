import { describe, it, expect } from './test-utils.ts';

import {
  formatGtfsError,
  GtfsErrorCode,
  importGtfs,
  isGtfsError,
} from '../../dist/index.js';

describe('gtfs errors', () => {
  it('should throw a typed config validation error', async () => {
    let didThrow = false;

    try {
      await importGtfs({
        agencies: [{} as never],
        verbose: false,
      });
    } catch (error: unknown) {
      didThrow = true;
      expect(isGtfsError(error)).toBeTruthy();

      if (isGtfsError(error)) {
        expect(error.code).toBe(GtfsErrorCode.GTFS_CONFIG_INVALID);
      }
    }

    expect(didThrow).toBeTruthy();
  });

  it('should return import report when includeImportReport is enabled', async () => {
    const report = await importGtfs({
      agencies: [{ path: '/does/not/exist' }],
      ignoreErrors: true,
      includeImportReport: true,
      verbose: false,
    });

    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errorCountsByCode[GtfsErrorCode.GTFS_DOWNLOAD_FAILED]).toBe(
      1,
    );
  });

  it('should format developer-safe error details', () => {
    const output = formatGtfsError(new Error('boom'), {
      verbosity: 'developer',
    });
    expect(output).toMatch('UNKNOWN_ERROR: boom');
  });
});
