import type {
  GtfsDatabase,
  GtfsEnumerationValue,
  GtfsFieldDefinition,
  GtfsInsert,
  GtfsQuery,
  GtfsRow,
  GtfsStoredRow,
} from '../schema/index.ts';
import type { GtfsScheduleTableName } from '../schema/database.ts';
import type { TableNames } from '../types/global_interfaces.ts';
import type { frequencies } from '../schema/tables/gtfs-schedule/frequencies.ts';
import type { stopTimes } from '../schema/tables/gtfs-schedule/stop-times.ts';
import type { vehiclePositions } from '../schema/tables/gtfs-realtime/vehicle-positions.ts';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type Assert<Value extends true> = Value;

type Frequency = GtfsRow<typeof frequencies>;
type StoredFrequency = GtfsStoredRow<typeof frequencies>;
type StoredStopTime = GtfsStoredRow<typeof stopTimes>;
type FrequencyInsert = GtfsInsert<typeof frequencies>;
type FrequencyQuery = GtfsQuery<typeof frequencies>;
type VehiclePosition = GtfsRow<typeof vehiclePositions>;
type EnumerationField = Extract<GtfsFieldDefinition, { kind: 'enumeration' }>;
type ScalarField = Exclude<GtfsFieldDefinition, { kind: 'enumeration' }>;

type _TripIdIsRequiredString = Assert<Equal<Frequency['trip_id'], string>>;
type _ExactTimesIsInteger = Assert<
  Equal<Frequency['exact_times'], number | null>
>;
type _RealtimeEnumerationAcceptsKnownValue = Assert<
  'STOPPED_AT' extends NonNullable<VehiclePosition['current_status']>
    ? true
    : false
>;
type _RealtimeEnumerationAcceptsFutureValue = Assert<
  'FUTURE_STATUS' extends NonNullable<VehiclePosition['current_status']>
    ? true
    : false
>;
type _ClosedEnumerationRejectsFutureValue = Assert<
  Equal<
    Extract<'FUTURE_STATUS', GtfsEnumerationValue<'STOPPED_AT', true>>,
    never
  >
>;
type _StartTimestampIsGenerated = Assert<
  Equal<StoredFrequency['start_timestamp'], number>
>;
type _EndPickupDropOffWindowTimestampIsGenerated = Assert<
  Equal<StoredStopTime['end_pickup_drop_off_window_timestamp'], number | null>
>;
type _DatabaseUsesTableName = Assert<
  Equal<GtfsDatabase['frequencies'], StoredFrequency>
>;
type _InsertRequiresTripId = Assert<
  Equal<Pick<FrequencyInsert, 'trip_id'>, { trip_id: string }>
>;
type _QueryAcceptsInValues = Assert<
  readonly string[] extends NonNullable<FrequencyQuery['trip_id']>
    ? true
    : false
>;
type _EnumerationRequiresValues = Assert<
  Equal<
    EnumerationField['values'],
    readonly [string | number, ...(string | number)[]]
  >
>;
type _ScalarForbidsValues = Assert<Equal<ScalarField['values'], undefined>>;
type _TableNamesUseScheduleDefinitions = Assert<
  Equal<TableNames, GtfsScheduleTableName>
>;
type _TableNamesIncludeFareLegJoinRules = Assert<
  'fare_leg_join_rules' extends TableNames ? true : false
>;
type _TableNamesExcludeRealtimeTables = Assert<
  Equal<Extract<TableNames, 'trip_updates'>, never>
>;

export type SchemaTypeAssertions =
  | _TripIdIsRequiredString
  | _ExactTimesIsInteger
  | _RealtimeEnumerationAcceptsKnownValue
  | _RealtimeEnumerationAcceptsFutureValue
  | _ClosedEnumerationRejectsFutureValue
  | _StartTimestampIsGenerated
  | _EndPickupDropOffWindowTimestampIsGenerated
  | _DatabaseUsesTableName
  | _InsertRequiresTripId
  | _QueryAcceptsInValues
  | _EnumerationRequiresValues
  | _ScalarForbidsValues
  | _TableNamesUseScheduleDefinitions
  | _TableNamesIncludeFareLegJoinRules
  | _TableNamesExcludeRealtimeTables;
