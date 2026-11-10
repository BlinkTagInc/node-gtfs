import type { Kysely, RawBuilder } from 'kysely';

import type {
  CompiledGtfsColumn,
  CompiledGtfsTable,
} from '../../../schema/compile-table.ts';
import type { GtfsSortDirection } from '../../../types/query.ts';
import type { GtfsDatabaseDialect } from '../../dialects.ts';

export interface PortableQueryOrderBy {
  readonly field: string;
  readonly direction?: GtfsSortDirection;
}

export interface PortableFindManyOptions {
  readonly where?: Readonly<Record<string, unknown>>;
  readonly select?: readonly string[];
  readonly orderBy?: readonly PortableQueryOrderBy[];
  readonly limit?: number;
  readonly offset?: number;
}

export interface PortableReadContext<DB> {
  readonly database: Kysely<DB>;
  readonly dialect: GtfsDatabaseDialect;
  readonly table: CompiledGtfsTable;
  readonly sourceIds: readonly string[] | null;
  /** Validated table-specific predicates supplied by repository extensions. */
  readonly additionalWhere?: readonly RawBuilder<boolean>[];
}

export interface PortableQueryField {
  readonly publicName: string;
  readonly storageName: string;
  readonly column: CompiledGtfsColumn | null;
}

export interface PortableQueryPlan {
  readonly selectedFields: readonly PortableQueryField[];
  readonly orderBy: readonly {
    readonly field: PortableQueryField;
    readonly direction: 'asc' | 'desc';
  }[];
  readonly limit?: number;
  readonly offset?: number;
}
