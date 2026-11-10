import { type AliasedRawBuilder, sql } from 'kysely';

import type { GtfsDatabaseDialect } from '../../dialects.ts';
import { castMonetaryStorageToText } from '../money.ts';
import type { PortableQueryField } from './types.ts';

interface PortableQuerySelection {
  readonly expressions: readonly AliasedRawBuilder<unknown, string>[];
  readonly hiddenCurrencies: ReadonlyMap<string, string>;
}

export function compilePortableQuerySelection(
  dialect: GtfsDatabaseDialect,
  selectedFields: readonly PortableQueryField[],
): PortableQuerySelection {
  const selectedNames = new Set(
    selectedFields.map((field) => field.publicName),
  );
  const hiddenCurrencies = new Map<string, string>();
  const expressions: AliasedRawBuilder<unknown, string>[] = selectedFields.map(
    (field) => {
      if (field.column?.monetary) {
        const currencyField = field.column.monetary.currencyField;
        if (!selectedNames.has(currencyField)) {
          hiddenCurrencies.set(
            currencyField,
            `_node_gtfs_query_currency_${currencyField}`,
          );
        }
        return castMonetaryStorageToText(dialect, field.storageName).as(
          field.publicName,
        );
      }
      return sql.ref(field.storageName).as(field.publicName);
    },
  );
  for (const [currencyField, alias] of hiddenCurrencies) {
    expressions.push(sql.ref(currencyField).as(alias));
  }

  return { expressions, hiddenCurrencies };
}
