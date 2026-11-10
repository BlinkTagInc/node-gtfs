import type * as tables from './tables/index.ts';

type TableDefinitionsByName = {
  readonly [
    Key in keyof typeof tables as (typeof tables)[Key]['tableName']
  ]: (typeof tables)[Key];
};

export type TableDefinitionByName<Name extends string> =
  Name extends keyof TableDefinitionsByName
    ? TableDefinitionsByName[Name]
    : never;
