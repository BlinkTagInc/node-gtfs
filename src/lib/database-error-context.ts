const DATABASE_ERROR_FIELDS = [
  'code',
  'errno',
  'sqlState',
  'constraint',
  'schema',
  'table',
  'column',
  'detail',
] as const;

/** Extracts driver error metadata without exposing SQL. */
export function getDatabaseErrorContext(
  error: unknown,
): Record<string, unknown> {
  if (!error || typeof error !== 'object') return {};

  const candidate = error as Record<string, unknown>;
  return Object.fromEntries(
    DATABASE_ERROR_FIELDS.flatMap((field) =>
      candidate[field] === undefined
        ? []
        : [
            [
              `database${field[0].toUpperCase()}${field.slice(1)}`,
              candidate[field],
            ],
          ],
    ),
  );
}
