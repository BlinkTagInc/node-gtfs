import type { GtfsDatabase } from './database.ts';

/** Stored row for a table in the canonical GTFS database schema. */
export type GtfsTableRow<TableName extends keyof GtfsDatabase> =
  GtfsDatabase[TableName];

type NonNullableField<
  TableName extends keyof GtfsDatabase,
  FieldName extends keyof GtfsDatabase[TableName],
> = NonNullable<GtfsDatabase[TableName][FieldName]>;

// gtfs-schedule
export type Agency = GtfsTableRow<'agency'>;
export type Area = GtfsTableRow<'areas'>;
export type Attribution = GtfsTableRow<'attributions'>;
export type BookingRule = GtfsTableRow<'booking_rules'>;
export type Calendar = GtfsTableRow<'calendar'>;
export type CalendarDate = GtfsTableRow<'calendar_dates'>;
export type FareAttribute = GtfsTableRow<'fare_attributes'>;
export type FareLegJoinRule = GtfsTableRow<'fare_leg_join_rules'>;
export type FareLegRule = GtfsTableRow<'fare_leg_rules'>;
export type FareMedia = GtfsTableRow<'fare_media'>;
export type FareProduct = GtfsTableRow<'fare_products'>;
export type FareRule = GtfsTableRow<'fare_rules'>;
export type FareTransferRule = GtfsTableRow<'fare_transfer_rules'>;
export type FeedInfo = GtfsTableRow<'feed_info'>;
export type Frequency = GtfsTableRow<'frequencies'>;
export type Level = GtfsTableRow<'levels'>;
export type LocationGroupStop = GtfsTableRow<'location_group_stops'>;
export type LocationGroup = GtfsTableRow<'location_groups'>;
export type Location = GtfsTableRow<'locations'>;
export type Network = GtfsTableRow<'networks'>;
export type Pathway = GtfsTableRow<'pathways'>;
export type RiderCategory = GtfsTableRow<'rider_categories'>;
export type RouteNetwork = GtfsTableRow<'route_networks'>;
export type Route = GtfsTableRow<'routes'>;
export type Shape = GtfsTableRow<'shapes'>;
export type StopArea = GtfsTableRow<'stop_areas'>;
export type StopTime = GtfsTableRow<'stop_times'>;
export type Stop = GtfsTableRow<'stops'>;
export type Timeframe = GtfsTableRow<'timeframes'>;
export type Transfer = GtfsTableRow<'transfers'>;
export type Translation = GtfsTableRow<'translations'>;
export type Trip = GtfsTableRow<'trips'>;

// gtfs-realtime
export type ServiceAlertInformedEntity =
  GtfsTableRow<'service_alert_informed_entities'>;
export type ServiceAlertRow = GtfsTableRow<'service_alerts'>;
export type StopTimeUpdate = GtfsTableRow<'stop_time_updates'>;
export type TripUpdate = GtfsTableRow<'trip_updates'>;
export type VehiclePosition = GtfsTableRow<'vehicle_positions'>;

export type GtfsRealtimeTripScheduleRelationship = NonNullableField<
  'trip_updates',
  'schedule_relationship'
>;
export type GtfsRealtimeStopTimeScheduleRelationship = NonNullableField<
  'stop_time_updates',
  'schedule_relationship'
>;
export type GtfsRealtimeOccupancyStatus = NonNullableField<
  'vehicle_positions',
  'occupancy_status'
>;
export type GtfsRealtimeWheelchairAccessible = NonNullableField<
  'vehicle_positions',
  'vehicle_wheelchair_accessible'
>;
export type GtfsRealtimeDropOffPickupType = NonNullableField<
  'stop_time_updates',
  'pickup_type'
>;
export type GtfsRealtimeAlertCause = NonNullableField<
  'service_alerts',
  'cause'
>;
export type GtfsRealtimeAlertEffect = NonNullableField<
  'service_alerts',
  'effect'
>;
export type GtfsRealtimeAlertSeverity = NonNullableField<
  'service_alerts',
  'severity_level'
>;
export type GtfsRealtimeVehicleStopStatus = NonNullableField<
  'vehicle_positions',
  'current_status'
>;
export type GtfsRealtimeCongestionLevel = NonNullableField<
  'vehicle_positions',
  'congestion_level'
>;

export type ServiceAlert = ServiceAlertRow & {
  informed_entities: ServiceAlertInformedEntity[];
};

// gtfs-plus
export type CalendarAttribute = GtfsTableRow<'calendar_attributes'>;
export type Direction = GtfsTableRow<'directions'>;
export type RouteAttribute = GtfsTableRow<'route_attributes'>;
export type StopAttribute = GtfsTableRow<'stop_attributes'>;

// gtfs-ride
export type BoardAlight = GtfsTableRow<'board_alight'>;
export type RideFeedInfo = GtfsTableRow<'ride_feed_info'>;
export type RiderTrip = GtfsTableRow<'rider_trip'>;
export type Ridership = GtfsTableRow<'ridership'>;
export type TripCapacity = GtfsTableRow<'trip_capacity'>;

// gtfs-to-html
export type TimetableNote = GtfsTableRow<'timetable_notes'>;
export type TimetableNotesReference =
  GtfsTableRow<'timetable_notes_references'>;
export type TimetablePage = GtfsTableRow<'timetable_pages'>;
export type TimetableStopOrder = GtfsTableRow<'timetable_stop_order'>;
export type Timetable = GtfsTableRow<'timetables'>;
export type TimetableNoteScope = NonNullableField<'timetable_notes', 'scope'>;

// noptis
export type TripsDatedVehicleJourney =
  GtfsTableRow<'trips_dated_vehicle_journey'>;

// tods
export type DeadheadTime = GtfsTableRow<'deadhead_times'>;
export type Deadhead = GtfsTableRow<'deadheads'>;
export type OpsLocation = GtfsTableRow<'ops_locations'>;
export type RunEvent = GtfsTableRow<'run_event'>;
export type RunPiece = GtfsTableRow<'runs_pieces'>;

// tides
export type Device = GtfsTableRow<'devices'>;
export type FareTransaction = GtfsTableRow<'fare_transactions'>;
export type Operator = GtfsTableRow<'operators'>;
export type PassengerEvent = GtfsTableRow<'passenger_events'>;
export type StationActivity = GtfsTableRow<'station_activities'>;
export type StopVisit = GtfsTableRow<'stop_visits'>;
export type TrainCar = GtfsTableRow<'train_cars'>;
export type TripPerformed = GtfsTableRow<'trips_performed'>;
export type VehicleLocation = GtfsTableRow<'vehicle_locations'>;
export type VehicleTrainCar = GtfsTableRow<'vehicle_train_cars'>;
export type Vehicle = GtfsTableRow<'vehicles'>;
