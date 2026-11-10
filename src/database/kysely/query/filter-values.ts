import { createGtfsQueryError } from '../../../diagnostics/errors.ts';
import {
  getServiceDateWeekday,
  parseGtfsTimeToServiceDaySeconds,
} from '../../../values/service-time.ts';
import { decimalStringToMinorUnits } from '../../../values/money.ts';
import type { GtfsQueryValue } from '../../../types/query.ts';
import type { PortableQueryField } from './types.ts';

export function getFilterCurrencyScope(
  where: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const scope: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(where)) {
    if (typeof value === 'string') {
      scope[field] = value;
    }
  }
  return scope;
}

export function normalizeQueryFilterValue({
  field,
  value,
  currencyWhere,
  tableName,
}: {
  readonly field: PortableQueryField;
  readonly value: unknown;
  readonly currencyWhere: Readonly<Record<string, unknown>>;
  readonly tableName: string;
}): GtfsQueryValue {
  const invalid = (expected: string, cause?: unknown): never => {
    throw createGtfsQueryError(
      `Invalid value for \`${field.publicName}\`; expected ${expected}`,
      {
        table: tableName,
        field: field.publicName,
        value,
      },
      cause,
    );
  };
  if (value === null) {
    return null;
  }
  const column = field.column;
  if (column?.monetary) {
    const currencyField = column.monetary.currencyField;
    const currency = currencyWhere[currencyField];
    if (typeof currency !== 'string') {
      throw createGtfsQueryError(
        `\`${currencyField}\` must be a currency code when filtering \`${field.publicName}\``,
        {
          table: tableName,
          field: field.publicName,
          currencyField,
        },
      );
    }
    if (typeof value !== 'string') {
      return invalid('a decimal monetary string');
    }
    try {
      return decimalStringToMinorUnits(value, currency);
    } catch (error) {
      return invalid(
        `a monetary value using currency ${JSON.stringify(currency)}`,
        error,
      );
    }
  }
  const kind =
    column?.valueKind ??
    (field.publicName.endsWith('_service_day_seconds') ? 'integer' : 'text');
  switch (kind) {
    case 'time': {
      const seconds =
        typeof value === 'string'
          ? parseGtfsTimeToServiceDaySeconds(value)
          : null;
      return seconds ?? invalid('a valid GTFS time in H+:mm:ss format');
    }
    case 'integer': {
      if (
        (typeof value === 'number' && Number.isSafeInteger(value)) ||
        (typeof value === 'bigint' &&
          value >= -(2n ** 63n) &&
          value < 2n ** 63n)
      ) {
        return value;
      }
      return invalid('a safe integer or signed 64-bit bigint');
    }
    case 'real':
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : invalid('a finite number');
    case 'date': {
      if (typeof value !== 'number') {
        return invalid('a valid date in YYYYMMDD format');
      }
      try {
        getServiceDateWeekday(value);
        return value;
      } catch (error) {
        return invalid('a valid date in YYYYMMDD format', error);
      }
    }
    default:
      return typeof value === 'string' ? value : invalid('a string');
  }
}
