import type {
  GtfsValidationNotice,
  GtfsValidationNoticeCode,
} from '../diagnostics/errors.ts';

export const VALIDATION_SAMPLE_LIMIT = 100;

export interface GtfsValidationSummary {
  readonly countsByCode: Readonly<
    Partial<Record<GtfsValidationNoticeCode, number>>
  >;
  readonly countsBySeverity: Readonly<
    Record<GtfsValidationNotice['severity'], number>
  >;
  readonly samples: readonly GtfsValidationNotice[];
  readonly truncated: boolean;
}

export interface MutableGtfsValidationSummary {
  countsByCode: Partial<Record<GtfsValidationNoticeCode, number>>;
  countsBySeverity: Record<GtfsValidationNotice['severity'], number>;
  samples: GtfsValidationNotice[];
  truncated: boolean;
}

export function createValidationSummary(): MutableGtfsValidationSummary {
  return {
    countsByCode: {},
    countsBySeverity: { error: 0, warn: 0, info: 0 },
    samples: [],
    truncated: false,
  };
}

export function collectValidationNotice(
  summary: MutableGtfsValidationSummary,
  notice: GtfsValidationNotice,
): void {
  summary.countsByCode[notice.code] =
    (summary.countsByCode[notice.code] ?? 0) + 1;
  summary.countsBySeverity[notice.severity] += 1;
  if (summary.samples.length < VALIDATION_SAMPLE_LIMIT) {
    summary.samples.push(notice);
  } else {
    summary.truncated = true;
  }
}

export function freezeValidationSummary(
  summary: GtfsValidationSummary,
): GtfsValidationSummary {
  return Object.freeze({
    countsByCode: Object.freeze({ ...summary.countsByCode }),
    countsBySeverity: Object.freeze({ ...summary.countsBySeverity }),
    samples: Object.freeze([...summary.samples]),
    truncated: summary.truncated,
  });
}
