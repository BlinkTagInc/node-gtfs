import {
  readConfigObject,
  readConfigEnum,
  validateKnownConfigKeys,
} from '../config/readers.ts';
import {
  addConfigIssue,
  throwConfigIssues,
  type ConfigValidationContext,
} from '../config/validation.ts';
import type {
  GtfsReportingLevel,
  GtfsReporter,
  GtfsReportingConfig,
} from './types.ts';
import { DEFAULT_GTFS_REPORTING_LEVELS } from '../config/defaults.ts';

export function resolveReportingConfig(
  value: unknown,
  context: ConfigValidationContext,
): GtfsReportingConfig & { readonly level: GtfsReportingLevel } {
  const reporting = readConfigObject(value, 'reporting', context) ?? {};
  validateKnownConfigKeys(
    reporting,
    'reporting',
    ['level', 'reporter'],
    context,
  );
  const reporter = reporting.reporter;
  if (reporter !== undefined && typeof reporter !== 'function') {
    addConfigIssue(
      context,
      'invalid-type',
      'reporting.reporter',
      'Configuration option `reporting.reporter` must be a function',
    );
  }
  if (context.format === 'json' && reporter !== undefined) {
    addConfigIssue(
      context,
      'invalid-combination',
      'reporting.reporter',
      'Configuration option `reporting.reporter` is available only in JavaScript configuration',
    );
  }
  return Object.freeze({
    level: readConfigEnum(
      reporting.level,
      'reporting.level',
      context,
      ['silent', 'error', 'warn', 'info'] as const,
      reporter === undefined
        ? DEFAULT_GTFS_REPORTING_LEVELS.withoutReporter
        : DEFAULT_GTFS_REPORTING_LEVELS.withReporter,
    ),
    ...(typeof reporter === 'function'
      ? { reporter: reporter as GtfsReporter }
      : {}),
  });
}

export function assertReportingConfig(reporting: GtfsReportingConfig): void {
  const context: ConfigValidationContext = {
    format: 'javascript',
    operation: 'realtime',
    issues: [],
  };
  resolveReportingConfig(reporting, context);
  if (context.issues.length > 0) {
    throwConfigIssues(context.issues);
  }
}
