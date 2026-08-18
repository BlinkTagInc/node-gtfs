/**
 * Applies a prefix to a value if the column should be prefixed and the value is not null
 * @param value The value to prefix
 * @param columnShouldBePrefixed Whether the column should be prefixed
 * @param prefix The prefix to apply
 * @returns The value with the prefix applied if the column should be prefixed and the value is not null
 */
export function applyPrefixToValue<
  Value extends string | number | null | undefined,
>(
  value: Value,
  columnShouldBePrefixed?: boolean,
  prefix?: string,
): Value | string {
  if (
    !columnShouldBePrefixed ||
    prefix === undefined ||
    value === null ||
    value === undefined
  ) {
    return value;
  }

  return `${prefix}${value}`;
}
