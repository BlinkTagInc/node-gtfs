import type {
  GtfsDefaultRow,
  GtfsSelectableRow,
} from '../schema/define-table.ts';
import type { TableDefinitionByName } from '../schema/repository-fields.ts';
import type { GtfsRepositoryQueryExtensionRow } from '../schema/repository-query-extensions.ts';

type Selectable<Name extends string> = GtfsSelectableRow<
  TableDefinitionByName<Name>
>;
type Field<Name extends string> = Extract<keyof Selectable<Name>, string>;
export interface GtfsFieldOrder<Name extends string> {
  readonly field: Field<Name>;
  readonly direction?: 'asc' | 'desc';
}
export type GtfsEqualityFilter<Name extends string> = {
  readonly [Key in keyof Selectable<Name>]?: Exclude<
    Selectable<Name>[Key],
    undefined
  >;
} & Partial<GtfsRepositoryQueryExtensionRow<Name>> & {
    readonly call?: never;
    readonly apply?: never;
  };

export interface GtfsQuery<
  Name extends string,
  Row extends object = GtfsDefaultRow<TableDefinitionByName<Name>>,
> {
  where(filter: GtfsEqualityFilter<Name>): GtfsQuery<Name, Row>;
  select<const Keys extends readonly [Field<Name>, ...Field<Name>[]]>(
    ...fields: Keys
  ): GtfsQuery<Name, Pick<Selectable<Name>, Keys[number]>>;
  orderBy(order: readonly GtfsFieldOrder<Name>[]): GtfsQuery<Name, Row>;
  limit(count: number): GtfsQuery<Name, Row>;
  offset(count: number): GtfsQuery<Name, Row>;
  count(): Promise<number>;
  all(): Promise<Row[]>;
  stream(): AsyncIterableIterator<Row>;
  first(filter?: GtfsEqualityFilter<Name>): Promise<Row | null>;
  firstOrThrow(filter?: GtfsEqualityFilter<Name>): Promise<Row>;
}
export interface GtfsRepository<Name extends string> extends GtfsQuery<Name> {
  readonly tableName: Name;
  readonly specification: string;
  readonly filename: string | null;
}
