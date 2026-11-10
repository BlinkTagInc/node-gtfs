# Cancel an operation

[All guides](README.md)

Pass `signal: AbortSignal` to `gtfs.import()`, `gtfs.export()`, or
`gtfs.realtime.refresh()`. The standalone `importGtfs()`, `exportGtfs()`, and
`refreshGtfsRealtime()` functions accept the same top-level option. Signals are
JavaScript operation options, not instance defaults or JSON configuration.

Use a caller's existing signal, or create a controller. For example, stop an
import after a caller-defined deadline:

```js
import { GtfsErrorCode, isGtfsError } from 'gtfs';

const controller = new AbortController();
const timer = setTimeout(() => {
  controller.abort(new Error('Import deadline exceeded'));
}, 30_000);

try {
  await gtfs.import({ signal: controller.signal });
} catch (error) {
  if (isGtfsError(error) && error.code === GtfsErrorCode.OPERATION_CANCELLED) {
    console.log('Import stopped:', error.cause);
  } else {
    throw error;
  }
} finally {
  clearTimeout(timer);
}
```

Cancellation rejects with `GTFS_OPERATION_CANCELLED`, category `cancellation`.
The error's `cause` is the original `signal.reason`. If transaction cleanup also
fails, [both errors are retained](reporting.md#catch-an-error), and the signal
reason is in `cause.errors[0].cause`. A configured reporter
receives a structured error message when a running operation is cancelled;
the operation does not emit a successful completion event.

An already-aborted signal prevents the operation from starting. Cancelling a
queued call rejects promptly and prevents it from running. A running operation
rejects after its rollback and cleanup finish. The instance and borrowed
connections remain usable after successful cleanup, and the signal does not
affect later calls.

## What is preserved

- **Import:** the current source replacement rolls back. Sources committed
  earlier in the call remain imported. Cancellation stops the call even with
  `onSourceError: "continue"`. Temporary downloads and validation files are removed.
- **GTFS-Realtime:** the current snapshot rolls back; snapshots already committed
  remain. Cancellation stops download retries.
- **Export:** cancellation before publication removes partial output and leaves
  any previous export intact. Once publication starts, it finishes or restores
  the previous output on failure. A later abort does not undo a published export.

Schema creation, completed commits, and index/statistics work are not undone.
Cancellation is not a transaction around the entire multi-source operation.

If you supply an existing Kysely transaction, cancelled writes roll back to a
savepoint. The transaction stays open under your control; node-GTFS does not
commit or discard your other work.
For a borrowed MySQL transaction, create the required schema and indexes before
opening the transaction. Imports and GTFS-Realtime refreshes validate that schema
instead of creating it, because MySQL schema changes commit transactions.

## Timing and limits

Downloads combine the caller signal with each configured download timeout. A
download timeout remains a download failure; caller cancellation remains a
cancellation error, even if the caller's reason is named `TimeoutError`.

Parsing, validation, and writes check cancellation between batches. Export closes
its active cursor during cleanup. Database statements already running are allowed
to finish before rollback or cursor release; they are not forcibly interrupted.
Synchronous SQLite statements and individual JSON/protobuf decoding steps also
finish before cancellation is observed. A signal is therefore not a hard upper
bound on total execution time.

`close()` still drains operations; it does not abort them. Use an operation's
controller to request cancellation before closing.

## Next steps

- [Handle cancellation and cleanup errors](reporting.md#catch-an-error).
- [Manage connection ownership and recovery](databases.md#connection-ownership-and-closing).
- [Understand Schedule replacement and rollback](import.md#replace-an-updated-static-gtfs-feed).
- [Understand export publication and recovery](export.md#choose-a-safe-output-directory).
- [Understand GTFS-Realtime refresh and history](realtime.md#refresh-behavior-and-history).
