import type { createGtfsWorkingBatches } from '../../src/schedule/import/staging/batches.ts';
import type { NormalizedImportRecord } from '../../src/schedule/import/records.ts';
import type { GtfsCsvSourcePosition } from '../../src/diagnostics/position.ts';
import type { GtfsValidationSourceRecord } from '../../src/validation/types.ts';

type Assert<Value extends true> = Value;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type ReplayedRecord<
  Batches extends { records: (...args: never[]) => unknown },
> =
  ReturnType<Batches['records']> extends Generator<infer Record>
    ? Record
    : never;

type Row = { readonly id: string; readonly amount: bigint | null };
type Batches = ReturnType<
  typeof createGtfsWorkingBatches<Row, GtfsCsvSourcePosition>
>;
type InputRecord = Parameters<Batches['append']>[2];
type OutputRecord = ReplayedRecord<Batches>;

export type ReconstructedRecordHasOnlyRowAndPosition = Assert<
  Equal<keyof OutputRecord, 'row' | 'position'>
>;
export type ReconstructedRowRetainsItsFieldTypes = Assert<
  Equal<OutputRecord['row'], Row>
>;
export type ReconstructedPositionRetainsItsKind = Assert<
  Equal<OutputRecord['position'], GtfsCsvSourcePosition>
>;
export type AppendAndReadUseTheSameRecordShape = Assert<
  Equal<InputRecord, OutputRecord>
>;
export type ExtraEnvelopeFieldsAreNotPromised = Assert<
  Equal<
    OutputRecord extends InputRecord & { label: string } ? true : false,
    false
  >
>;
export type WrongRowValuesAreRejected = Assert<
  Equal<
    {
      row: { id: number; amount: null };
      position: GtfsCsvSourcePosition;
    } extends InputRecord
      ? true
      : false,
    false
  >
>;
export type WrongPositionKindsAreRejected = Assert<
  Equal<
    {
      row: Row;
      position: { kind: 'geojson'; featureNumber: number };
    } extends InputRecord
      ? true
      : false,
    false
  >
>;
export type DefaultBatchesReconstructNormalizedRecords = Assert<
  Equal<
    ReplayedRecord<ReturnType<typeof createGtfsWorkingBatches>>,
    NormalizedImportRecord
  >
>;
export type ReferenceBatchesReconstructValidationRecords = Assert<
  Equal<
    ReplayedRecord<
      ReturnType<
        typeof createGtfsWorkingBatches<
          GtfsValidationSourceRecord['row'],
          GtfsValidationSourceRecord['position']
        >
      >
    >,
    GtfsValidationSourceRecord
  >
>;
