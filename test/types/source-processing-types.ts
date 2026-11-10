import type {
  GtfsDirectImportSourceOptions,
  GtfsImportSourceOptions,
  GtfsNormalizedBatchSink,
  GtfsSourceProcessing,
  scanGtfsSourceFile,
} from '../../src/schedule/import/scan.ts';
import type { ValidateGtfsSourceOptions } from '../../src/validation/types.ts';

type Assert<Value extends true> = Value;
type Accepts<Value> = Value extends GtfsSourceProcessing ? true : false;
type Rejects<Value> = Accepts<Value> extends false ? true : false;

export type StagingAcceptsImportOptions = Assert<
  Accepts<{ mode: 'stage'; options: GtfsImportSourceOptions }>
>;
export type DirectDeliveryAcceptsRestrictedOptionsAndSink = Assert<
  Accepts<{
    mode: 'direct';
    options: GtfsDirectImportSourceOptions;
    sink: GtfsNormalizedBatchSink;
  }>
>;
export type StagingCannotWriteDirectly = Assert<
  Rejects<{
    mode: 'stage';
    options: GtfsImportSourceOptions;
    sink: GtfsNormalizedBatchSink;
  }>
>;
export type StagingRequiresSourceIdentity = Assert<
  Rejects<{ mode: 'stage'; options: ValidateGtfsSourceOptions }>
>;
export type DirectDeliveryRequiresSink = Assert<
  Rejects<{ mode: 'direct'; options: GtfsDirectImportSourceOptions }>
>;
export type DirectDeliveryRequiresSourceIdentity = Assert<
  Rejects<{
    mode: 'direct';
    options: Omit<GtfsDirectImportSourceOptions, 'sourceId'>;
    sink: GtfsNormalizedBatchSink;
  }>
>;

type DirectWithPolicy<Policy> = {
  mode: 'direct';
  options: Omit<GtfsDirectImportSourceOptions, keyof Policy> & Policy;
  sink: GtfsNormalizedBatchSink;
};
export type StrictValidationRequiresStaging = Assert<
  Rejects<DirectWithPolicy<{ mode: 'strict' }>>
>;
export type PermissiveValidationRequiresStaging = Assert<
  Rejects<DirectWithPolicy<{ mode: 'permissive' }>>
>;
export type DiscardingUnknownFieldsRequiresStaging = Assert<
  Rejects<DirectWithPolicy<{ onUnknownField: 'discard' }>>
>;
export type RejectingUnknownFieldsRequiresStaging = Assert<
  Rejects<DirectWithPolicy<{ onUnknownField: 'reject' }>>
>;
export type KeepingFirstDuplicatesRequiresStaging = Assert<
  Rejects<DirectWithPolicy<{ onDuplicateKey: 'keep-first' }>>
>;
export type FileScannerTakesOneNamedOptionsObject = Assert<
  Parameters<typeof scanGtfsSourceFile> extends [
    { processing: GtfsSourceProcessing },
  ]
    ? true
    : false
>;
