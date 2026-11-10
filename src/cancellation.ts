import { AsyncLocalStorage } from 'node:async_hooks';
import { setImmediate } from 'node:timers/promises';
import {
  GtfsError,
  GtfsErrorCode,
  createGtfsConfigError,
  isGtfsError,
} from './diagnostics/errors.ts';
import { log } from './reporting/report.ts';
import type { GtfsReportingConfig } from './reporting/types.ts';
import { isPlainObject } from './config/options.ts';

// Operation-scoped context also reaches transactional writers without storing a
// caller's signal on a shared connection. Cleanup deliberately has no checkpoints.
const cancellation = new AsyncLocalStorage<{
  readonly signal: AbortSignal | undefined;
  reporting: GtfsReportingConfig;
}>();

export function readOperationSignal(options: {
  readonly signal?: unknown;
}): AbortSignal | undefined {
  if (!isPlainObject(options)) {
    throw createGtfsConfigError('Operation options must be an object');
  }
  if (
    Object.hasOwn(options, 'signal') &&
    !(options.signal instanceof AbortSignal)
  ) {
    throw createGtfsConfigError(
      'Operation option `signal` must be an AbortSignal',
      { path: 'signal' },
    );
  }
  return options.signal as AbortSignal | undefined;
}

export function getOperationSignal(): AbortSignal | undefined {
  return cancellation.getStore()?.signal;
}

export function setCancellationReporting(reporting: GtfsReportingConfig): void {
  const context = cancellation.getStore();
  if (context !== undefined) {
    context.reporting = reporting;
  }
}

export function throwIfOperationAborted(signal = getOperationSignal()): void {
  if (signal?.aborted) {
    throw new GtfsError('GTFS operation cancelled', {
      code: GtfsErrorCode.OPERATION_CANCELLED,
      cause: signal.reason,
    });
  }
}

export async function cancellationCheckpoint(): Promise<void> {
  const signal = getOperationSignal();
  if (signal !== undefined) {
    throwIfOperationAborted(signal);
    await setImmediate();
    throwIfOperationAborted(signal);
  }
}

export function downloadSignal(timeoutMs: number): {
  readonly signal: AbortSignal;
  readonly dispose: () => void;
} {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort(new DOMException('Download timed out', 'TimeoutError'));
  }, timeoutMs);
  timer.unref();
  const caller = getOperationSignal();
  return {
    signal:
      caller === undefined
        ? timeout.signal
        : AbortSignal.any([caller, timeout.signal]),
    dispose: () => clearTimeout(timer),
  };
}

/** Only a queued caller may return early; running work must finish rollback/cleanup. */
export function cancelWhileQueued<Result>(
  signal: AbortSignal | undefined,
  enqueue: (operation: () => Promise<Result>) => Promise<Result>,
  operation: () => Promise<Result>,
): Promise<Result> {
  if (signal === undefined) {
    return enqueue(operation);
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      try {
        throwIfOperationAborted(signal);
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    const queued = enqueue(() => {
      signal.removeEventListener('abort', abort);
      throwIfOperationAborted(signal);
      return operation();
    });
    void queued
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

export function throwIfDownloadCancelled(signal: AbortSignal): void {
  const caller = getOperationSignal();
  if (caller?.aborted && signal.aborted && signal.reason === caller.reason) {
    throwIfOperationAborted(caller);
  }
}

export function withOperationCancellation<Result>(
  signal: AbortSignal | undefined,
  reporting: GtfsReportingConfig,
  operation: () => Promise<Result>,
): Promise<Result> {
  const context = { signal, reporting };
  return cancellation.run(context, async () => {
    try {
      throwIfOperationAborted();
      return await operation();
    } catch (error) {
      if (
        isGtfsError(error) &&
        error.code === GtfsErrorCode.OPERATION_CANCELLED
      ) {
        log(context.reporting, 'error', error);
      }
      throw error;
    }
  });
}
