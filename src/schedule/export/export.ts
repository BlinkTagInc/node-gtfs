import {
  cancellationCheckpoint,
  setCancellationReporting,
  throwIfOperationAborted,
} from '../../cancellation.ts';
import type Database from 'better-sqlite3';

import { Kysely } from 'kysely';

import {
  formatCount,
  formatFileList,
  pluralize,
} from '../../reporting/format.ts';
import {
  beginReportingOperation,
  log,
  report,
  status,
} from '../../reporting/report.ts';
import {
  fileBackedTables,
  compiledTableRegistry,
  type FileBackedCompiledGtfsTable,
} from '../../schema/table-registry.ts';
import type { ResolvedGtfsExportConfig } from '../../config/resolver.ts';
import {
  asDynamicKysely,
  type GtfsDynamicKysely,
} from '../../database/clients.ts';
import type { GtfsDatabaseDialect } from '../../database/dialects.ts';
import { validateGtfsQuerySchema } from '../../database/query-schema.ts';
import {
  filterGtfsTablesByExtensions,
  resolveGtfsExtensions,
} from '../../schema/extensions.ts';
import {
  resolveExportOutputDirectory,
  resolveExportSource,
  type PortableExportOptions,
} from './source.ts';
import {
  writePortableExportFiles,
  type PortableExportFilesResult,
} from './tables.ts';
import { prepareExportOutput } from './output.ts';
import type { GtfsExportResult } from '../../types/export.ts';

interface PortableExportConnectionContext {
  readonly database: GtfsDynamicKysely;
  readonly sqlite?: Database.Database;
  readonly databaseDescription: string;
  readonly dialect: GtfsDatabaseDialect;
}

export interface PortableExportContext extends PortableExportConnectionContext {
  readonly physicalColumns: ReadonlyMap<string, ReadonlySet<string>>;
}

export async function createValidatedExportContext(options: {
  connection: PortableExportConnectionContext;
  enabledTables: readonly FileBackedCompiledGtfsTable[];
}): Promise<PortableExportContext> {
  const { connection, enabledTables } = options;
  const physicalColumns = await validateGtfsQuerySchema({
    database: connection.database,
    dialect: connection.dialect,
    tables: [compiledTableRegistry.agency, ...enabledTables],
  });
  return { ...connection, physicalColumns };
}

async function exportPortableGtfs(options: {
  config: PortableExportOptions;
  connection: PortableExportConnectionContext;
}): Promise<GtfsExportResult> {
  const { config, connection } = options;
  beginReportingOperation(config);
  setCancellationReporting(config);
  const enabledTables: readonly FileBackedCompiledGtfsTable[] =
    filterGtfsTablesByExtensions(
      fileBackedTables,
      resolveGtfsExtensions(config.extensions),
    );
  await cancellationCheckpoint();
  const startTime = process.hrtime.bigint();
  const context = await createValidatedExportContext({
    connection,
    enabledTables,
  });
  const source = await resolveExportSource({
    config,
    database: context.database,
  });

  report(config, {
    type: 'operation:start',
    operation: 'export',
    sourceCount: 1,
    sourceIds: [source.sourceId],
    databaseDescription: connection.databaseDescription,
  });

  const outputDirectory = resolveExportOutputDirectory({
    config,
    source,
  });
  throwIfOperationAborted();
  const output = await prepareExportOutput({
    outputDirectory,
    overwrite: config.overwrite,
  });
  let exported: PortableExportFilesResult;
  try {
    exported = await writePortableExportFiles({
      run: { config, context, source, outputDirectory: output.writeDirectory },
      enabledTables,
    });
    await cancellationCheckpoint();
    await output.publish();
  } catch (cause: unknown) {
    return await output.fail(cause);
  } finally {
    try {
      await output.close();
    } catch {
      log(
        config,
        'warn',
        `Could not release the export reservation at ${JSON.stringify(output.lockDirectory)}`,
      );
    }
  }
  try {
    await output.cleanup();
  } catch {
    log(
      config,
      'warn',
      `Export completed, but temporary output at ${JSON.stringify(output.workDirectory)} could not be removed`,
    );
  }

  if (exported.files.length === 0) {
    log(config, 'warn', 'No GTFS data exported; import GTFS data first');
  } else if (exported.emptyScheduleFiles.length > 0) {
    status(
      config,
      formatFileList('No data to export', [...exported.emptyScheduleFiles]),
    );
  }

  const result: GtfsExportResult = Object.freeze({
    sourceId: source.sourceId,
    outputDirectory,
    files: exported.files,
    durationMs: Number((process.hrtime.bigint() - startTime) / 1_000_000n),
  });
  const recordCount = result.files.reduce(
    (total, file) => total + file.recordCount,
    0,
  );
  report(config, {
    type: 'operation:complete',
    operation: 'export',
    durationMs: result.durationMs,
    destination: outputDirectory,
    summary: `${pluralize('file', 'files', result.files.length)}, ${formatCount(recordCount)} rows`,
  });
  return result;
}

/** Runs a resolved export on an already-open, caller-owned Kysely connection. */
export function exportGtfsOnConnection<DB>(options: {
  resolved: ResolvedGtfsExportConfig<DB>;
  database: Kysely<DB>;
  sqlite?: Database.Database;
  databaseDescription: string;
}): Promise<GtfsExportResult> {
  const { resolved, database, databaseDescription } = options;
  const config: PortableExportOptions = Object.freeze({
    level: resolved.reporting.level,
    ...(resolved.reporting.reporter === undefined
      ? {}
      : { reporter: resolved.reporting.reporter }),
    extensions: resolved.extensions,
    ...resolved.export,
  });
  return exportPortableGtfs({
    config,
    connection: {
      database: asDynamicKysely(database),
      ...(options.sqlite === undefined ? {} : { sqlite: options.sqlite }),
      dialect: resolved.database.dialect,
      databaseDescription,
    },
  });
}
