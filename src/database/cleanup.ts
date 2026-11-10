import { GtfsError, isGtfsError } from '../diagnostics/errors.ts';
import { getDatabaseErrorContext } from './error-context.ts';

const combinedErrors = new WeakSet<GtfsError>();

export function createDatabaseRecoveryError(
  primary: unknown,
  message = 'Could not complete database cleanup',
): GtfsError {
  return new GtfsError(isGtfsError(primary) ? primary.message : message, {
    ...(isGtfsError(primary)
      ? primary
      : {
          code: 'GTFS_DATABASE_OPERATION_FAILED',
        }),
    details: {
      ...(isGtfsError(primary)
        ? primary.details
        : getDatabaseErrorContext(primary)),
      databaseRecoveryRequired: true,
    },
    cause: primary,
  });
}

/** Preserve the original error, then append cleanup failures in attempt order. */
export function createDatabaseCleanupError(
  primary: unknown,
  cleanup: unknown,
): GtfsError {
  const error = createDatabaseRecoveryError(
    primary,
    'Database operation failed and cleanup also failed',
  );
  const previous =
    isGtfsError(primary) &&
    combinedErrors.has(primary) &&
    primary.cause instanceof AggregateError
      ? primary.cause.errors
      : [primary];
  error.cause = new AggregateError(
    [...previous, cleanup],
    'Database cleanup failed',
  );
  combinedErrors.add(error);
  return error;
}

function cleanupFailure(
  error: unknown,
  failure: { error: unknown } | undefined,
): GtfsError {
  if (failure !== undefined) {
    return createDatabaseCleanupError(failure.error, error);
  }
  return isGtfsError(error) && error.details?.databaseRecoveryRequired === true
    ? error
    : createDatabaseRecoveryError(error);
}

export async function withDatabaseCleanup<Result>(
  operation: () => Promise<Result>,
  cleanup: () => void | Promise<void>,
): Promise<Result> {
  let outcome: { value: Result } | { error: unknown };
  try {
    outcome = { value: await operation() };
  } catch (error) {
    outcome = { error };
  }
  try {
    await cleanup();
  } catch (error) {
    throw cleanupFailure(error, 'error' in outcome ? outcome : undefined);
  }
  if ('error' in outcome) {
    throw outcome.error;
  }
  return outcome.value;
}

export function withSyncDatabaseCleanup<Result>(
  operation: () => Result,
  cleanup: () => void,
): Result {
  let outcome: { value: Result } | { error: unknown };
  try {
    outcome = { value: operation() };
  } catch (error) {
    outcome = { error };
  }
  try {
    cleanup();
  } catch (error) {
    throw cleanupFailure(error, 'error' in outcome ? outcome : undefined);
  }
  if ('error' in outcome) {
    throw outcome.error;
  }
  return outcome.value;
}
