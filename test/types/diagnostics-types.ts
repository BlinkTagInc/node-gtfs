import {
  GtfsError,
  isGtfsError,
  type GtfsConfigIssue,
  type GtfsCsvSourcePosition,
  type GtfsErrorDetails,
  type GtfsGeoJSONSourcePosition,
  type GtfsRealtimeSourcePosition,
  type GtfsImportResult,
  type GtfsReportedError,
  type GtfsReportEvent,
  type GtfsSourcePosition,
  type GtfsValidationNotice,
  type GtfsValidationNoticeDetails,
} from 'gtfs';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

const csv: GtfsCsvSourcePosition = {
  kind: 'csv',
  recordNumber: 2,
  csvLineNumber: 5,
};
const geojson: GtfsGeoJSONSourcePosition = {
  kind: 'geojson',
  featureNumber: 3,
};
const issue: GtfsConfigIssue = {
  reason: 'invalid-value',
  path: 'reporting.level',
  message: 'Choose a supported reporting level',
};
const details: GtfsErrorDetails = {
  errors: [issue],
  customContext: { retry: false },
  databaseRecoveryRequired: true,
};
const noticeDetails: GtfsValidationNoticeDetails = {
  fields: ['stop_id'],
};
const diagnostic = new GtfsError('Diagnostic', {
  code: 'GTFS_CONFIG_INVALID',
  details,
  positions: [csv, geojson],
});

function positionNumber(position: GtfsSourcePosition): number {
  if (position.kind === 'csv') {
    const narrowed: GtfsCsvSourcePosition = position;
    // @ts-expect-error CSV positions do not have feature numbers.
    void position.featureNumber;
    return narrowed.csvLineNumber;
  }
  if (position.kind === 'realtime') {
    const narrowed: GtfsRealtimeSourcePosition = position;
    // @ts-expect-error Realtime positions do not have CSV line numbers.
    void position.csvLineNumber;
    return narrowed.entityNumber;
  }
  const narrowed: GtfsGeoJSONSourcePosition = position;
  // @ts-expect-error GeoJSON positions do not have CSV record numbers.
  void position.recordNumber;
  return narrowed.featureNumber;
}

declare const caught: unknown;
if (isGtfsError(caught)) {
  const issues: readonly GtfsConfigIssue[] = caught.details?.errors ?? [];
  const position: GtfsSourcePosition | undefined = caught.position;
  const positions: readonly GtfsSourcePosition[] = caught.positions ?? [];
  const recoveryRequired: true | undefined =
    caught.details?.databaseRecoveryRequired;
  const notices: readonly GtfsValidationNotice[] =
    caught.details?.validation?.samples ?? [];
  void [issues, position, positions, notices, recoveryRequired];
}

declare const event: GtfsReportEvent;
if (event.type === 'message') {
  const issues: readonly GtfsConfigIssue[] = event.error?.details?.errors ?? [];
  void issues;
} else if (event.type === 'validation:notice') {
  const position: GtfsSourcePosition | undefined = event.notice.position;
  void position;
}

type _ErrorDetails = Assert<
  Equal<NonNullable<GtfsError['details']>, GtfsErrorDetails>
>;
type _ReportedErrorDetails = Assert<
  Equal<NonNullable<GtfsReportedError['details']>, GtfsErrorDetails>
>;
type _ImportErrorDetails = Assert<
  Equal<
    NonNullable<GtfsImportResult['errors'][number]['details']>,
    GtfsErrorDetails
  >
>;
type _ConfigIssues = Assert<
  Equal<GtfsErrorDetails['errors'], readonly GtfsConfigIssue[] | undefined>
>;
type _NoticeDetails = Assert<
  Equal<
    NonNullable<GtfsValidationNotice['details']>,
    GtfsValidationNoticeDetails
  >
>;
type _PositionKinds = Assert<
  Equal<GtfsSourcePosition['kind'], 'csv' | 'geojson' | 'realtime'>
>;

const invalidIssue: GtfsConfigIssue = {
  // @ts-expect-error Configuration issues have a fixed reason vocabulary.
  reason: 'typo',
  path: 'a',
  message: 'a',
};
// @ts-expect-error Configuration issues are read-only.
issue.path = 'other';
// @ts-expect-error Source positions are read-only.
csv.recordNumber = 5;
// @ts-expect-error Configuration issue arrays are read-only.
details.errors?.push(issue);
// @ts-expect-error Batch position arrays are read-only.
diagnostic.positions?.push(csv);
// @ts-expect-error Known diagnostic fields cannot contain arbitrary values.
const invalidDetails: GtfsErrorDetails = { errors: ['not an issue'] };
// @ts-expect-error CSV positions require a physical line number.
const missingLine: GtfsSourcePosition = { kind: 'csv', recordNumber: 1 };
const invalidPosition = new GtfsError('Invalid position', {
  code: 'GTFS_INVALID_VALUE',
  // @ts-expect-error GeoJSON feature numbers are numeric.
  position: { kind: 'geojson', featureNumber: '1' },
});

void [
  diagnostic,
  noticeDetails,
  details,
  positionNumber,
  invalidIssue,
  invalidDetails,
  missingLine,
  invalidPosition,
];
