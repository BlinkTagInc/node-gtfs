import type { CompiledGtfsColumn } from '../schema/compile-table.ts';
import type { GtfsRowCondition } from '../schema/define-table.ts';
import { parseGtfsTimeToServiceDaySeconds } from '../values/service-time.ts';

export function isEmptyGtfsValue(
  value: unknown,
): value is '' | null | undefined {
  return value === '' || value === null || value === undefined;
}

export function matchesGtfsRowCondition(
  row: Readonly<Record<string, string>>,
  condition: GtfsRowCondition,
): boolean {
  const value = row[condition.field];
  if ('equals' in condition) {
    return String(value) === String(condition.equals);
  }
  return (
    condition.in?.some((candidate) => String(value) === String(candidate)) ??
    false
  );
}

export function getComparableGtfsValue(
  value: string,
  column: CompiledGtfsColumn,
): number {
  if (column.valueKind === 'time') {
    return parseGtfsTimeToServiceDaySeconds(value) ?? NaN;
  }
  return Number(value);
}
