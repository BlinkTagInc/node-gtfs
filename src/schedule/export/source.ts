import path from 'node:path';
import { createHash } from 'node:crypto';
import { snakeCase } from 'lodash-es';
import sanitize from 'sanitize-filename';

import { GTFS_SOURCE_ID_COLUMN } from '../../schema/compile-table.ts';
import { log } from '../../reporting/report.ts';
import type { GtfsReportingConfig } from '../../reporting/types.ts';
import type { GtfsDynamicKysely } from '../../database/clients.ts';
import { expandHomeDirectory } from '../../io/paths.ts';
import { GtfsErrorCategory, GtfsErrorCode } from '../../diagnostics/errors.ts';
import type { GtfsExtension } from '../../schema/extensions.ts';
import { createGtfsExportError } from './error.ts';

export interface PortableExportOptions extends GtfsReportingConfig {
  readonly extensions: readonly GtfsExtension[];
  readonly outputDirectory?: string;
  readonly overwrite: boolean;
  readonly sourceId?: string;
  readonly batchSize: number;
}

interface ExportAgency {
  readonly source_id: string;
  readonly agency_name: string;
}

export interface ResolvedExportSource {
  readonly sourceId: string;
  readonly agencyName: string;
}

function sanitizeDirectoryName(folderName: string): string {
  if (!folderName || typeof folderName !== 'string') {
    throw new Error('Folder name must be a non-empty string');
  }
  return snakeCase(sanitize(folderName));
}

async function getExportAgencies(
  database: GtfsDynamicKysely,
  sourceId: string | undefined,
): Promise<ExportAgency[]> {
  let query = database
    .selectFrom('agency')
    .select([GTFS_SOURCE_ID_COLUMN, 'agency_name']);
  if (sourceId !== undefined) {
    query = query.where(GTFS_SOURCE_ID_COLUMN, '=', sourceId);
  }
  return (await query.execute()) as ExportAgency[];
}

export async function resolveExportSource(options: {
  config: PortableExportOptions;
  database: GtfsDynamicKysely;
}): Promise<ResolvedExportSource> {
  const { config, database } = options;
  const agencies = await getExportAgencies(database, config.sourceId);
  const firstAgency = agencies.at(0);
  if (firstAgency === undefined) {
    throw createGtfsExportError(
      config.sourceId === undefined
        ? 'No Schedule data found; import data before exporting'
        : `No Schedule data found for source ${JSON.stringify(config.sourceId)}`,
      {
        code: GtfsErrorCode.DATABASE_SOURCE_NOT_FOUND,
        details: { sourceId: config.sourceId },
      },
    );
  }

  const sourceIds = [
    ...new Set(agencies.map(({ source_id: sourceId }) => sourceId)),
  ];
  if (config.sourceId === undefined && sourceIds.length > 1) {
    throw createGtfsExportError(
      'Database contains multiple GTFS sources; set the `export.sourceId` in configuration to export one source',
      {
        category: GtfsErrorCategory.CONFIG,
        code: GtfsErrorCode.CONFIG_INVALID,
        details: { sourceIds },
      },
    );
  }

  const sourceId = config.sourceId ?? firstAgency.source_id;
  if (agencies.length > 1) {
    log(
      config,
      'warn',
      `More than one agency belongs to source ${JSON.stringify(sourceId)}; exporting them in one GTFS file`,
    );
  }
  return { sourceId, agencyName: firstAgency.agency_name };
}

export function resolveExportOutputDirectory(options: {
  config: PortableExportOptions;
  source: ResolvedExportSource;
}): string {
  const { config, source } = options;
  let outputDirectory: string;
  if (config.outputDirectory !== undefined) {
    outputDirectory = path.resolve(expandHomeDirectory(config.outputDirectory));
  } else {
    const exportRoot = path.resolve('gtfs-export');
    // Bound the display prefix for multibyte filenames without truncating the
    // digest. Hash the original source identity, not its sanitized spelling.
    const agencyName = source.agencyName
      ? sanitizeDirectoryName(source.agencyName).slice(0, 48)
      : '';
    const sourceHash = createHash('sha256')
      .update(JSON.stringify(source.sourceId))
      .digest('hex');
    outputDirectory = path.resolve(
      exportRoot,
      `${agencyName || 'feed'}-${sourceHash}`,
    );
    if (path.dirname(outputDirectory) !== exportRoot) {
      throw createGtfsExportError(
        'Could not choose a safe default export directory; set the `export.outputDirectory` configuration option to a safe path',
        {
          code: GtfsErrorCode.EXPORT_WRITE_FAILED,
          category: GtfsErrorCategory.EXPORT,
          details: {
            sourceId: source.sourceId,
            outputDirectory,
            reason: 'unsafe-default-output-directory',
          },
        },
      );
    }
  }
  return outputDirectory;
}
