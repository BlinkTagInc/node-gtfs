import type { NormalizedRealtimeValue } from './writer.ts';

type RealtimeAlertPeriodKind = 'communication' | 'impact' | 'active';

export interface InspectedRealtimeAlertPeriod {
  readonly rangeKind: RealtimeAlertPeriodKind;
  readonly rangeOrdinal: number;
  readonly startUnixSeconds: NormalizedRealtimeValue;
  readonly endUnixSeconds: NormalizedRealtimeValue;
  readonly isValid: boolean;
  /** Exact integer values used only for validation and never serialized. */
  readonly comparisonStart: bigint | null;
  readonly comparisonEnd: bigint | null;
}

export interface RealtimeAlertPeriodIssue {
  readonly kind: 'invalid-range' | 'impact-not-contained';
  readonly rangeKind: RealtimeAlertPeriodKind;
  readonly rangeOrdinal: number;
  readonly message: string;
}

interface RealtimeAlertPeriodInspection {
  readonly periods: readonly InspectedRealtimeAlertPeriod[];
}

interface RawTimeRange {
  readonly start?: unknown;
  readonly end?: unknown;
}

interface BoundaryInspection {
  readonly valid: boolean;
  readonly storage: NormalizedRealtimeValue;
  readonly comparison: bigint | null;
}

const PORTABLE_INTEGER_MAX = 9_223_372_036_854_775_807n;

function inspectBoundary(value: unknown): BoundaryInspection {
  if (value === undefined || value === null) {
    return { valid: true, storage: null, comparison: null };
  }

  if (typeof value === 'bigint') {
    return value >= 0n && value <= PORTABLE_INTEGER_MAX
      ? { valid: true, storage: value, comparison: value }
      : { valid: false, storage: null, comparison: null };
  }

  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0
      ? { valid: true, storage: value, comparison: BigInt(value) }
      : { valid: false, storage: null, comparison: null };
  }

  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'object' &&
          typeof (value as { toString?: unknown }).toString === 'function'
        ? String(value)
        : null;
  if (text === null || !/^\d+$/u.test(text)) {
    return { valid: false, storage: null, comparison: null };
  }
  const comparison = BigInt(text);
  return comparison <= PORTABLE_INTEGER_MAX
    ? { valid: true, storage: text, comparison }
    : { valid: false, storage: null, comparison: null };
}

function rangeContains(
  outer: InspectedRealtimeAlertPeriod,
  inner: InspectedRealtimeAlertPeriod,
): boolean {
  const startsBefore =
    outer.comparisonStart === null ||
    (inner.comparisonStart !== null &&
      outer.comparisonStart <= inner.comparisonStart);
  const endsAfter =
    outer.comparisonEnd === null ||
    (inner.comparisonEnd !== null &&
      outer.comparisonEnd >= inner.comparisonEnd);
  return startsBefore && endsAfter;
}

/** Inspects every source range without collapsing multiple or open periods. */
export function inspectRealtimeAlertPeriods(
  alert: unknown,
  onIssue: (issue: RealtimeAlertPeriodIssue) => void,
): RealtimeAlertPeriodInspection {
  const source = (alert ?? {}) as {
    communicationPeriod?: readonly RawTimeRange[];
    impactPeriod?: readonly RawTimeRange[];
    activePeriod?: readonly RawTimeRange[];
  };
  const periodSources = [
    ['communication', source.communicationPeriod],
    ['impact', source.impactPeriod],
    ['active', source.activePeriod],
  ] as const;
  const periods: InspectedRealtimeAlertPeriod[] = [];

  for (const [rangeKind, ranges] of periodSources) {
    for (const [rangeOrdinal, range] of (ranges ?? []).entries()) {
      const start = inspectBoundary(range?.start);
      const end = inspectBoundary(range?.end);
      const ordered =
        start.comparison === null ||
        end.comparison === null ||
        start.comparison < end.comparison;
      const isValid = start.valid && end.valid && ordered;
      const period: InspectedRealtimeAlertPeriod = {
        rangeKind,
        rangeOrdinal,
        startUnixSeconds: start.storage,
        endUnixSeconds: end.storage,
        isValid,
        comparisonStart: start.comparison,
        comparisonEnd: end.comparison,
      };
      periods.push(period);
      if (!isValid) {
        onIssue({
          kind: 'invalid-range',
          rangeKind,
          rangeOrdinal,
          message:
            `${rangeKind}_period[${rangeOrdinal}] must use portable non-negative integer bounds ` +
            'with start strictly less than end when both are present',
        });
      }
    }
  }

  const communicationPeriods = periods.filter(
    (period) => period.rangeKind === 'communication',
  );
  if (communicationPeriods.length > 0) {
    const validCommunicationPeriods = communicationPeriods.filter(
      (period) => period.isValid,
    );
    for (const impactPeriod of periods.filter(
      (period) => period.rangeKind === 'impact' && period.isValid,
    )) {
      if (
        !validCommunicationPeriods.some((communicationPeriod) =>
          rangeContains(communicationPeriod, impactPeriod),
        )
      ) {
        const periodIndex = periods.indexOf(impactPeriod);
        periods[periodIndex] = { ...impactPeriod, isValid: false };
        onIssue({
          kind: 'impact-not-contained',
          rangeKind: 'impact',
          rangeOrdinal: impactPeriod.rangeOrdinal,
          message:
            `impact_period[${impactPeriod.rangeOrdinal}] is not fully contained ` +
            'within one communication_period range',
        });
      }
    }
  }

  return { periods };
}
