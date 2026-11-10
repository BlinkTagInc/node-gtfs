export interface GtfsExportFileResult {
  readonly filename: string;
  /** CSV data records (excluding the header), or GeoJSON features. */
  readonly recordCount: number;
}

export interface GtfsExportResult {
  readonly sourceId: string;
  /** Resolved absolute path to the export directory. */
  readonly outputDirectory: string;
  /** Only files successfully written by this export. */
  readonly files: readonly GtfsExportFileResult[];
  readonly durationMs: number;
}
