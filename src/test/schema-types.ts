import type { routes as modelsRoutes } from 'gtfs/models';
import type { routes as schemaRoutes } from 'gtfs/schema';

import type {
  Agency,
  BoardAlight,
  CalendarAttribute,
  Deadhead,
  Device,
  GtfsDatabase,
  GtfsEnumerationValue,
  GtfsFieldDefinition,
  GtfsInsert,
  GtfsQuery,
  GtfsRow,
  GtfsStoredRow,
  GtfsTableRow,
  ServiceAlert,
  ServiceAlertRow,
  Timetable,
  TripsDatedVehicleJourney,
  VehiclePosition as PublicVehiclePosition,
} from '../schema/index.ts';
import type {
  GtfsFileBackedTableName,
  GtfsScheduleTableName,
} from '../schema/database.ts';
import type { frequencies } from '../schema/tables/gtfs-schedule/frequencies.ts';
import type { stopTimes } from '../schema/tables/gtfs-schedule/stop-times.ts';
import type { vehiclePositions } from '../schema/tables/gtfs-realtime/vehicle-positions.ts';
import type {
  GtfsExportConfig,
  GtfsFeedConfig,
  GtfsImportConfig,
  GtfsRealtimeConfig,
  SqliteQueryOptions,
  StopQueryOptions,
} from '../types/index.ts';

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

type _ModelsSubpathMatchesSchema = Assert<
  Equal<typeof modelsRoutes, typeof schemaRoutes>
>;

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
type _FileBackedNamesIncludeFareLegJoinRules = Assert<
  'fare_leg_join_rules' extends GtfsFileBackedTableName ? true : false
>;
type _FileBackedNamesIncludeExtensions = Assert<
  'timetables' extends GtfsFileBackedTableName ? true : false
>;
type _FileBackedNamesExcludeRealtimeTables = Assert<
  Equal<Extract<GtfsFileBackedTableName, 'trip_updates'>, never>
>;
type _ScheduleNamesRemainAvailable = Assert<
  'agency' extends GtfsScheduleTableName ? true : false
>;
type _ScheduleAliasComesFromSchema = Assert<
  Equal<Agency, GtfsTableRow<'agency'>>
>;
type _GtfsToHtmlAliasComesFromSchema = Assert<
  Equal<Timetable, GtfsTableRow<'timetables'>>
>;
type _GtfsPlusAliasComesFromSchema = Assert<
  Equal<CalendarAttribute, GtfsTableRow<'calendar_attributes'>>
>;
type _GtfsRideAliasComesFromSchema = Assert<
  Equal<BoardAlight, GtfsTableRow<'board_alight'>>
>;
type _RealtimeAliasComesFromSchema = Assert<
  Equal<PublicVehiclePosition, GtfsTableRow<'vehicle_positions'>>
>;
type _ComposedRealtimeResultUsesSchemaRow = Assert<
  ServiceAlert extends ServiceAlertRow & {
    informed_entities: unknown[];
  }
    ? true
    : false
>;
type _NoptisAliasComesFromSchema = Assert<
  Equal<TripsDatedVehicleJourney, GtfsTableRow<'trips_dated_vehicle_journey'>>
>;
type _TodsAliasComesFromSchema = Assert<
  Equal<Deadhead, GtfsTableRow<'deadheads'>>
>;
type _TidesAliasComesFromSchema = Assert<
  Equal<Device, GtfsTableRow<'devices'>>
>;
type _StaticFeedSourceIsExclusive = Assert<
  Equal<
    { url: string; path: string } extends GtfsFeedConfig ? true : false,
    false
  >
>;
type _KyselyImportConfigExcludesSqlite = Assert<
  Equal<Extract<keyof GtfsImportConfig, 'db' | 'sqlitePath'>, never>
>;
type _ExportConfigDoesNotRequireAgencies = Assert<
  Equal<Extract<keyof GtfsExportConfig, 'agencies'>, never>
>;
type _RealtimeConfigDoesNotRequireStaticSource = Assert<
  {
    agencies: [{ realtimeAlerts: { url: string } }];
  } extends GtfsRealtimeConfig
    ? true
    : false
>;
type _BoundingBoxIsStopSpecific = Assert<
  Equal<Extract<keyof SqliteQueryOptions, 'bounding_box_side_m'>, never>
>;
type _StopOptionsIncludeBoundingBox = Assert<
  'bounding_box_side_m' extends keyof StopQueryOptions ? true : false
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
  | _FileBackedNamesIncludeFareLegJoinRules
  | _FileBackedNamesIncludeExtensions
  | _FileBackedNamesExcludeRealtimeTables
  | _ScheduleNamesRemainAvailable
  | _ScheduleAliasComesFromSchema
  | _GtfsToHtmlAliasComesFromSchema
  | _GtfsPlusAliasComesFromSchema
  | _GtfsRideAliasComesFromSchema
  | _RealtimeAliasComesFromSchema
  | _ComposedRealtimeResultUsesSchemaRow
  | _NoptisAliasComesFromSchema
  | _TodsAliasComesFromSchema
  | _TidesAliasComesFromSchema
  | _StaticFeedSourceIsExclusive
  | _KyselyImportConfigExcludesSqlite
  | _ExportConfigDoesNotRequireAgencies
  | _RealtimeConfigDoesNotRequireStaticSource
  | _BoundingBoxIsStopSpecific
  | _StopOptionsIncludeBoundingBox;
