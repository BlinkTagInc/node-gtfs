import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  GtfsError,
  GtfsErrorCode,
  isGtfsError,
} from '../../diagnostics/errors.ts';

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

async function inspectDestination(outputDirectory: string) {
  try {
    return await fs.lstat(outputDirectory);
  } catch (error) {
    if (hasCode(error, 'ENOENT')) {
      return undefined;
    }
    throw error;
  }
}

function outputExists(outputDirectory: string) {
  return new GtfsError(
    `Export destination ${JSON.stringify(outputDirectory)} already exists; choose a new directory or set \`export.overwrite\` to true to replace it`,
    {
      code: GtfsErrorCode.EXPORT_OUTPUT_EXISTS,
      details: { outputDirectory, overwrite: false },
    },
  );
}

async function assertSafeExportReplacement({
  outputDirectory,
  parent,
  existing,
}: {
  readonly outputDirectory: string;
  readonly parent: string;
  readonly existing: Awaited<ReturnType<typeof inspectDestination>>;
}): Promise<void> {
  const canonical =
    existing === undefined
      ? outputDirectory
      : await fs.realpath(outputDirectory);
  const relativeCwd = path.relative(
    canonical,
    await fs.realpath(process.cwd()),
  );
  if (
    parent === outputDirectory ||
    canonical === (await fs.realpath(homedir())) ||
    relativeCwd === '' ||
    (!relativeCwd.startsWith(`..${path.sep}`) &&
      relativeCwd !== '..' &&
      !path.isAbsolute(relativeCwd)) ||
    (existing !== undefined &&
      (!existing.isDirectory() || existing.isSymbolicLink()))
  ) {
    throw new GtfsError(
      'Export replacement requires a dedicated directory, not a file, symbolic link, home directory, or working-directory ancestor',
      {
        code: GtfsErrorCode.EXPORT_WRITE_FAILED,
        details: { outputDirectory, reason: 'unsafe-output-directory' },
      },
    );
  }
}

export async function prepareExportOutput({
  outputDirectory,
  overwrite,
}: {
  readonly outputDirectory: string;
  readonly overwrite: boolean;
}) {
  const parent = path.dirname(outputDirectory);
  const lockName = createHash('sha256')
    .update(path.basename(outputDirectory))
    .digest('hex');
  const lockDirectory = path.join(parent, `.node-gtfs-export-${lockName}.lock`);
  let locked = false;
  let workDirectory: string | undefined;
  let writeDirectory = outputDirectory;
  let previousDirectory: string | undefined;

  async function releaseLock() {
    if (locked) {
      await fs.rmdir(lockDirectory);
      locked = false;
    }
  }

  try {
    const existing = await inspectDestination(outputDirectory);
    if (existing !== undefined && !overwrite) {
      throw outputExists(outputDirectory);
    }
    if (overwrite) {
      await assertSafeExportReplacement({ outputDirectory, parent, existing });
    }
    await fs.mkdir(parent, { recursive: true });
    try {
      await fs.mkdir(lockDirectory);
      locked = true;
    } catch (cause) {
      throw new GtfsError(
        'Could not reserve the export destination; another export may be using it',
        {
          code: GtfsErrorCode.EXPORT_WRITE_FAILED,
          details: {
            outputDirectory,
            lockDirectory,
            reason: 'output-reservation-failed',
          },
          cause,
        },
      );
    }
    if (overwrite) {
      workDirectory = await fs.mkdtemp(path.join(parent, '.node-gtfs-export-'));
      writeDirectory = path.join(workDirectory, 'new');
      await fs.mkdir(writeDirectory);
    } else {
      try {
        await fs.mkdir(outputDirectory);
      } catch (cause) {
        if (hasCode(cause, 'EEXIST')) {
          throw outputExists(outputDirectory);
        }
        throw cause;
      }
    }

    return {
      writeDirectory,
      workDirectory,
      lockDirectory,
      async publish() {
        if (workDirectory !== undefined) {
          const current = await inspectDestination(outputDirectory);
          if (
            current?.dev !== existing?.dev ||
            current?.ino !== existing?.ino ||
            (current !== undefined && !current.isDirectory())
          ) {
            throw new GtfsError(
              'Export destination changed while files were being generated; existing output was not replaced',
              {
                code: GtfsErrorCode.EXPORT_WRITE_FAILED,
                details: { outputDirectory, reason: 'output-changed' },
              },
            );
          }
          if (existing !== undefined) {
            const backup = path.join(workDirectory, 'previous');
            await fs.rename(outputDirectory, backup);
            previousDirectory = backup;
          }
          try {
            await fs.rename(writeDirectory, outputDirectory);
          } catch (cause) {
            if (previousDirectory !== undefined) {
              try {
                await fs.rename(previousDirectory, outputDirectory);
                previousDirectory = undefined;
              } catch (rollbackCause) {
                throw new GtfsError(
                  'Export replacement failed and previous output could not be restored; it remains in the recovery directory',
                  {
                    code: GtfsErrorCode.EXPORT_WRITE_FAILED,
                    details: {
                      outputDirectory,
                      recoveryDirectory: previousDirectory,
                    },
                    cause: new AggregateError([cause, rollbackCause]),
                  },
                );
              }
            }
            throw cause;
          }
        }
      },
      async cleanup() {
        if (workDirectory !== undefined) {
          await fs.rm(workDirectory, { recursive: true, force: true });
          previousDirectory = undefined;
        }
      },
      async fail(cause: unknown): Promise<never> {
        let error = isGtfsError(cause)
          ? cause
          : new GtfsError('Could not complete GTFS export', {
              code: GtfsErrorCode.EXPORT_WRITE_FAILED,
              cause,
            });
        const details = {
          ...error.details,
          outputDirectory,
          overwrite,
          ...(previousDirectory === undefined
            ? {}
            : { recoveryDirectory: previousDirectory }),
        };
        error.details = details;
        try {
          // Never remove the old export if replacement or rollback failed.
          if (workDirectory !== undefined) {
            await fs.rm(
              previousDirectory === undefined ? workDirectory : writeDirectory,
              { recursive: true, force: true },
            );
          } else {
            await fs.rm(outputDirectory, { recursive: true, force: true });
          }
        } catch (cleanupCause) {
          error = new GtfsError(
            'Export failed and partial output could not be removed',
            {
              code: GtfsErrorCode.EXPORT_WRITE_FAILED,
              details: {
                ...details,
                cleanupFailed: true,
                partialOutputDirectory: writeDirectory,
              },
              cause: new AggregateError([cause, cleanupCause]),
            },
          );
        }
        throw error;
      },
      close: releaseLock,
    };
  } catch (cause) {
    try {
      try {
        if (workDirectory !== undefined) {
          await fs.rm(workDirectory, { recursive: true, force: true });
        }
      } finally {
        await releaseLock();
      }
    } catch (cleanupCause) {
      throw new GtfsError(
        'Could not prepare the export destination and finish cleanup',
        {
          code: GtfsErrorCode.EXPORT_WRITE_FAILED,
          details: {
            outputDirectory,
            workDirectory,
            lockDirectory,
            cleanupFailed: true,
          },
          cause: new AggregateError([cause, cleanupCause]),
        },
      );
    }
    if (isGtfsError(cause)) {
      throw cause;
    }
    throw new GtfsError('Could not prepare the export destination', {
      code: GtfsErrorCode.EXPORT_WRITE_FAILED,
      details: { outputDirectory },
      cause,
    });
  }
}
