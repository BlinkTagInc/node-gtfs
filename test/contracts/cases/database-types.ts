import { type GtfsDatabase } from '../../../src/schema/index.ts';

export interface ConformanceDatabase {
  agency: {
    source_id: string;
    agency_id: string | null;
    agency_name: string;
    agency_url: string;
    agency_timezone: string;
  };
  fare_attributes: {
    source_id: string;
    fare_id: string;
    price: GtfsDatabase['fare_attributes']['price'];
    currency_type: string;
    payment_method: number;
    transfers: number | null;
  };
  stop_times: {
    source_id: string;
    trip_id: string;
    arrival_time: string | null;
    arrival_service_day_seconds: number | null;
    stop_id: string | null;
    stop_sequence: number;
  };
  stops: {
    source_id: string;
    stop_id: string;
    stop_name: string;
  };
}
