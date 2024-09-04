import CsvParse = require('csv-parse');
import Database = require('better-sqlite3');

export interface IAgency {
  exclude?: string[];
  url?: string;
  path?: string;
  headers?: Record<string, string>;
  realtimeAlerts?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeTripUpdates?: {
    url: string;
    headers?: Record<string, string>;
  };
  realtimeVehiclePositions?: {
    url: string;
    headers?: Record<string, string>;
  };
  prefix?: string;
}

export interface IConfig {
  db?: Database.Database;
  sqlitePath?: string;
  ignoreDuplicates?: boolean;
  gtfsRealtimeExpirationSeconds?: number;
  downloadTimeout?: number;
  csvOptions?: CsvParse.Options;
  exportPath?: string;
  ignoreErrors?: boolean;
  agencies: IAgency[];
  verbose?: boolean;
  logFunction?: (message: string) => void;
}

export interface IColumn {
  name: string;
  type: string;
  min?: number;
  max?: number;
  required?: boolean;
  primary?: boolean;
  index?: boolean;
  default?: string | number | null;
  nocase?: boolean;
  source?: string;
  prefix?: boolean;
}

export interface IModel {
  filenameBase: string;
  filenameExtension?: string;
  extension?: string;
  nonstandard?: boolean;
  schema: IColumn[];
}

export interface JoinOptions {
  type?: string;
  table: string;
  on: string;
}

export type SqlValue =
  | undefined
  | null
  | string
  | number
  | boolean
  | Date
  | SqlValue[];

export type SqlWhere = Record<string, null | SqlValue | SqlValue[]>;

export type SqlSelect = string[];

export type SqlOrderBy = Array<[string, 'ASC' | 'DESC']>;

export interface QueryOptions {
  db?: Database.Database;
  bounding_box_side_m?: number;
}

export type SqlResults = Array<Record<string, any>>;
