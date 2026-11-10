import {
  cancelWhileQueued,
  withOperationCancellation,
  throwIfOperationAborted,
} from './cancellation.ts';
import type {
  GtfsInstanceExportOptions,
  GtfsInstanceImportOptions,
  GtfsInstanceRealtimeRefreshOptions,
} from './types/operation.ts';
import {
  resolveInstanceImportOptions,
  resolveInstanceRefreshOptions,
  resolveInstanceExportOptions,
} from './config/operation-options.ts';
import { isPlainObject } from './config/options.ts';
import type Database from 'better-sqlite3';
import type { Kysely } from 'kysely';

import type { GtfsDatabase } from './schema/database.ts';
import type { GtfsSpecification } from './schema/define-table.ts';
import {
  compiledTableRegistry,
  compiledTables,
} from './schema/table-registry.ts';
import {
  generatedRepositoryDefinitions,
  type GtfsRepositoryProperties,
} from './generated/repositories.ts';
import type {
  GtfsReportingLevel,
  GtfsLogMessageLevel,
  GtfsReportingConfig,
} from './reporting/types.ts';
import {
  beginReportingOperation,
  log as reportLog,
  report,
} from './reporting/report.ts';
import {
  type GtfsSchemaInspection,
  type GtfsSchemaMode,
} from './database/schema-lifecycle.ts';
import type { GtfsDatabaseDialect } from './database/dialects.ts';
import {
  createGtfsConfigError,
  createGtfsQueryError,
  GtfsError,
  GtfsErrorCategory,
  GtfsErrorCode,
} from './diagnostics/errors.ts';
import type { GtfsImportResult } from './schedule/import/result.ts';
import { createGtfsDomainQueries } from './query/domain.ts';
import type { GtfsDomainQueries } from './types/domain-query.ts';
import { createGtfsRepository } from './query/repository.ts';
import { createGtfsStoragePlan } from './database/storage/plan.ts';
import {
  cleanupGtfsRealtime,
  type GtfsInstanceRealtimeCleanupOptions,
  type GtfsRealtimeCleanupResult,
} from './realtime/cleanup.ts';
import { exportGtfsOnConnection } from './schedule/export/export.ts';
import type { GtfsExportResult } from './types/export.ts';
import { importGtfsOnConnection } from './schedule/import/import.ts';
import { refreshGtfsRealtimeOnConnection } from './realtime/refresh.ts';
import { createGtfsGeoJSON } from './geojson/geojson.ts';
import type { GtfsGeoJSON } from './geojson/types.ts';
import {
  filterGtfsTablesByExtensions,
  type GtfsExtension,
  type GtfsExtensionOptions,
} from './schema/extensions.ts';
import type { CompiledGtfsTable } from './schema/compile-table.ts';
import type {
  GtfsConfig,
  GtfsInstanceSourceConfig,
  GtfsSourceConfig,
} from './types/config.ts';
import {
  resolveGtfsInstanceConfig,
  type ResolvedGtfsInstanceConfig,
} from './config/resolver.ts';
import {
  initializeGtfsConnection,
  closeOwnedGtfsConnection,
  type GtfsConnectionOwnership,
} from './database/connection.ts';
import { withDatabaseCleanup } from './database/cleanup.ts';
import { executeGtfsSchemaPlan } from './database/schema-executor.ts';

export type GtfsStoredTableName = Extract<keyof GtfsDatabase, string>;
export type { GtfsConnectionOwnership } from './database/connection.ts';

export interface GtfsTableMetadata<
  Name extends GtfsStoredTableName = GtfsStoredTableName,
> {
  readonly tableName: Name;
  readonly specification: GtfsSpecification;
  readonly filename: string | null;
}

export type GtfsTableMetadataCollection = {
  readonly [Name in GtfsStoredTableName]: GtfsTableMetadata<Name>;
};

const GTFS_TABLE_METADATA = Object.freeze(
  Object.fromEntries(
    compiledTables.map((table) => [
      table.tableName,
      Object.freeze({
        tableName: table.tableName,
        specification: table.specification,
        filename: table.filename,
      }),
    ]),
  ),
) as GtfsTableMetadataCollection;

export interface GtfsDatabaseAccess<DB = GtfsDatabase> {
  readonly dialect: GtfsDatabaseDialect;
  readonly ownership: GtfsConnectionOwnership;
  readonly withKysely: <Result>(
    options: GtfsWithKyselyOptions<DB, Result>,
  ) => Promise<Result>;
}

export interface GtfsSchema {
  readonly tables: GtfsTableMetadataCollection;
  readonly ensure: () => Promise<GtfsSchemaInspection>;
  readonly validate: () => Promise<GtfsSchemaInspection>;
  readonly recreate: () => Promise<GtfsSchemaInspection>;
}

export interface GtfsReporting extends GtfsReportingConfig {
  readonly level: GtfsReportingLevel;
  readonly log: (options: GtfsReportingLogOptions) => void;
}

export type GtfsInstanceOptions<DB = GtfsDatabase> = Omit<
  GtfsConfig<DB>,
  'sources' | 'extensions'
> &
  GtfsExtensionOptions & {
    /** Configured source scope. Omit to query every source in an existing database. */
    sources?: readonly (GtfsSourceConfig | GtfsInstanceSourceConfig)[];
  };

export interface GtfsWithKyselyOptions<DB, Result> {
  readonly callback: (database: Kysely<DB>) => Result | Promise<Result>;
}

export interface GtfsReportingLogOptions {
  readonly level: GtfsLogMessageLevel;
  readonly message: string | Error;
}

export type { GtfsInstanceExportOptions } from './types/operation.ts';

export interface GtfsRealtimeOperations {
  readonly refresh: {
    (): Promise<GtfsImportResult>;
    (options: GtfsInstanceRealtimeRefreshOptions): Promise<GtfsImportResult>;
  };
  readonly cleanup: (
    options?: GtfsInstanceRealtimeCleanupOptions,
  ) => Promise<GtfsRealtimeCleanupResult>;
}

function createCompletionSignal() {
  let complete = () => {};
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { promise, complete };
}

function assertNoOperationArguments(
  operation: string,
  args: readonly unknown[],
): void {
  if (args.length > 0) {
    throw createGtfsConfigError(
      `\`gtfs.${operation}()\` does not accept arguments; configure it on the instance`,
    );
  }
}

function assertInstanceRealtimeCleanupOptions(
  options: unknown,
): asserts options is GtfsInstanceRealtimeCleanupOptions {
  if (!isPlainObject(options)) {
    throw createGtfsConfigError(
      '`gtfs.realtime.cleanup()` accepts one named options object',
    );
  }
  const allowedOptions = [
    'nowUnixSeconds',
    'currentState',
    'snapshotHistory',
  ] as const;
  const unknownOption = Object.keys(options).find(
    (key) => !allowedOptions.includes(key as (typeof allowedOptions)[number]),
  );
  if (unknownOption !== undefined) {
    if (['extensions', 'reporting', 'sourceIds'].includes(unknownOption)) {
      throw createGtfsConfigError(
        `\`${unknownOption}\` is configured on the Gtfs instance and cannot be overridden by \`gtfs.realtime.cleanup()\``,
      );
    }
    throw createGtfsConfigError(
      `Unknown \`gtfs.realtime.cleanup()\` option ${JSON.stringify(unknownOption)}`,
    );
  }
}

function closedInstanceError(): GtfsError {
  return new GtfsError('Gtfs instance is closing or closed', {
    code: GtfsErrorCode.INSTANCE_CLOSED,
    category: GtfsErrorCategory.DATABASE,
  });
}

function beginSchemaOperationReporting(options: {
  mode: GtfsSchemaMode;
  reporting: GtfsReportingConfig;
  sourceIds: readonly string[] | null;
  databaseDescription: string;
  managedTableNames: readonly string[];
}): bigint | undefined {
  const { mode, reporting, sourceIds, databaseDescription, managedTableNames } =
    options;
  beginReportingOperation(reporting);
  if (mode === 'validate') {
    const validationStartTime = process.hrtime.bigint();
    report(reporting, {
      type: 'operation:start',
      operation: 'validation',
      ...(sourceIds === null
        ? {}
        : { sourceCount: sourceIds.length, sourceIds }),
      databaseDescription,
    });
    return validationStartTime;
  }
  if (mode === 'recreate') {
    report(reporting, {
      type: 'schema:recreate',
      databaseDescription,
      tables: managedTableNames,
    });
  }
  return undefined;
}

function completeSchemaValidationReporting(options: {
  inspection: GtfsSchemaInspection;
  reporting: GtfsReportingConfig;
  validationStartTime: bigint | undefined;
}): GtfsSchemaInspection {
  const { inspection, reporting, validationStartTime } = options;
  if (validationStartTime === undefined) {
    return inspection;
  }
  report(reporting, {
    type: 'operation:complete',
    operation: 'validation',
    durationMs: Number(
      (process.hrtime.bigint() - validationStartTime) / 1_000_000n,
    ),
    summary: inspection.compatible
      ? 'schema compatible'
      : `${inspection.tableIssues.length} schema differences`,
    result: {
      compatible: inspection.compatible,
      tableDifferenceCount: inspection.tableIssues.length,
    },
  });
  return inspection;
}

/** Backend-neutral GTFS database context with generated repositories. */
class GtfsInstance<DB = GtfsDatabase> {
  readonly database: Readonly<GtfsDatabaseAccess<DB>>;
  readonly schema: Readonly<GtfsSchema>;
  readonly reporting: Readonly<GtfsReporting>;
  readonly extensions: readonly GtfsExtension[];
  readonly sourceIds: readonly string[] | null;
  readonly geojson: GtfsGeoJSON;
  readonly query: GtfsDomainQueries;

  readonly #database: Kysely<DB>;
  readonly #sqlite: Database.Database | null;
  readonly #resolvedConfig: ResolvedGtfsInstanceConfig<DB>;
  readonly #databaseDescription: string;
  readonly #managedTables: readonly CompiledGtfsTable[];
  readonly #managedTableNames: readonly string[];
  readonly #parallelReads: boolean;
  #state: 'active' | 'closing' | 'closed' = 'active';
  #operationTail: Promise<void> = Promise.resolve();
  #exclusiveTail: Promise<void> = Promise.resolve();
  #closePromise: Promise<void> | null = null;
  readonly #activeStreams = new Set<AsyncIterableIterator<unknown>>();

  constructor(options: GtfsInstanceOptions<DB>) {
    const resolved = resolveGtfsInstanceConfig<DB>(options);
    const connection = initializeGtfsConnection(resolved.database);
    this.#resolvedConfig = resolved;
    this.#database = connection.database;
    this.#parallelReads =
      resolved.database.dialect !== 'sqlite' && !this.#database.isTransaction;
    this.#sqlite = connection.sqlite;
    this.#databaseDescription = connection.databaseDescription;
    this.database = Object.freeze({
      dialect: resolved.database.dialect,
      ownership: connection.ownership,
      withKysely: <Result>(options: GtfsWithKyselyOptions<DB, Result>) =>
        this.#withKysely(options),
    });
    this.extensions = Object.freeze([...resolved.extensions]);
    this.sourceIds =
      resolved.sources.length === 0
        ? null
        : Object.freeze(resolved.sources.map(({ sourceId }) => sourceId));
    this.reporting = Object.freeze({
      level: resolved.reporting.level,
      ...(resolved.reporting.reporter === undefined
        ? {}
        : { reporter: resolved.reporting.reporter }),
      log: (options: GtfsReportingLogOptions) => this.#log(options),
    });
    this.schema = Object.freeze({
      tables: GTFS_TABLE_METADATA,
      ensure: (...args: readonly unknown[]) =>
        this.#applySchema('ensure', ...args),
      validate: (...args: readonly unknown[]) =>
        this.#applySchema('validate', ...args),
      recreate: (...args: readonly unknown[]) =>
        this.#applySchema('recreate', ...args),
    });
    this.#managedTables = Object.freeze(
      filterGtfsTablesByExtensions(compiledTables, this.extensions),
    );
    this.#managedTableNames = Object.freeze(
      this.#managedTables.map((table) => table.tableName),
    );
    this.geojson = createGtfsGeoJSON<DB>({
      databaseOperation: (callback) => this.#readDatabase(callback),
      dialect: this.database.dialect,
      sourceIds: this.sourceIds,
      enabledExtensions: this.extensions,
    });
    this.query = createGtfsDomainQueries<DB>({
      databaseStream: (callback) => this.#streamDatabase(callback),
      databaseOperation: (callback) => this.#readDatabase(callback),
      dialect: this.database.dialect,
      sourceIds: this.sourceIds,
      enabledExtensions: this.extensions,
    });
    this.#installRepositoryProperties();
  }

  get isClosed(): boolean {
    return this.#state === 'closed';
  }

  import(): Promise<GtfsImportResult>;
  import(options: GtfsInstanceImportOptions): Promise<GtfsImportResult>;
  import(...args: readonly unknown[]): Promise<GtfsImportResult> {
    return this.#enqueueConfigured(
      () =>
        resolveInstanceImportOptions(
          this.#resolvedConfig,
          this.sourceIds,
          args,
        ),
      (resolved) =>
        importGtfsOnConnection(
          resolved,
          this.#sqlite === null
            ? { database: this.#database }
            : { sqlite: this.#sqlite },
        ),
    );
  }

  export(): Promise<GtfsExportResult>;
  export(options: GtfsInstanceExportOptions): Promise<GtfsExportResult>;
  export(...args: readonly unknown[]): Promise<GtfsExportResult> {
    return this.#enqueueConfigured(
      () =>
        resolveInstanceExportOptions(
          this.#resolvedConfig,
          this.sourceIds,
          args,
        ),
      (resolved) =>
        exportGtfsOnConnection({
          resolved,
          database: this.#database,
          ...(this.#sqlite === null ? {} : { sqlite: this.#sqlite }),
          databaseDescription: this.#databaseDescription,
        }),
    );
  }

  #enqueueConfigured<
    Config extends {
      readonly signal?: AbortSignal;
      readonly reporting: GtfsReportingConfig;
    },
    Result,
  >(
    resolve: () => Config,
    operation: (config: Config) => Promise<Result>,
  ): Promise<Result> {
    try {
      this.#assertDatabaseAvailable();
      // Resolve and snapshot options at call time, even if another operation is queued.
      const config = resolve();
      if (config.signal !== undefined) {
        throwIfOperationAborted(config.signal);
      }
      return cancelWhileQueued(
        config.signal,
        (run) => this.#enqueue(run),
        () =>
          withOperationCancellation(config.signal, config.reporting, () =>
            operation(config),
          ),
      );
    } catch (cause) {
      return Promise.reject(cause);
    }
  }

  #log(options: GtfsReportingLogOptions): void {
    if (this.#state !== 'active') {
      throw closedInstanceError();
    }
    reportLog(this.reporting, options.level, options.message);
  }

  #withKysely<Result>(
    options: GtfsWithKyselyOptions<DB, Result>,
  ): Promise<Result> {
    if (!options || typeof options.callback !== 'function') {
      return Promise.reject(
        createGtfsConfigError(
          '`database.withKysely` requires a named `callback`',
        ),
      );
    }
    return this.#enqueue(() => options.callback(this.#database));
  }

  #readDatabase<Result>(
    callback: (database: Kysely<DB>) => Result | Promise<Result>,
  ): Promise<Result> {
    return this.#enqueue(() => callback(this.#database), 'read');
  }

  #applySchema(
    mode: GtfsSchemaMode,
    ...args: readonly unknown[]
  ): Promise<GtfsSchemaInspection> {
    return this.#enqueue(
      async () => {
        assertNoOperationArguments(`schema.${mode}`, args);
        const storagePlan = createGtfsStoragePlan({
          dialect: this.database.dialect,
          mode,
          extensions: this.extensions,
        });
        const validationStartTime = beginSchemaOperationReporting({
          mode,
          reporting: this.#resolvedConfig.reporting,
          sourceIds: this.sourceIds,
          databaseDescription: this.#databaseDescription,
          managedTableNames: this.#managedTableNames,
        });
        const inspection = await executeGtfsSchemaPlan({
          database: this.#database,
          sqlite: this.#sqlite,
          storagePlan,
        });
        return completeSchemaValidationReporting({
          inspection,
          reporting: this.#resolvedConfig.reporting,
          validationStartTime,
        });
      },
      mode === 'validate' ? 'read' : 'exclusive',
    );
  }

  #runRealtimeCleanup(
    options: GtfsInstanceRealtimeCleanupOptions = {},
  ): Promise<GtfsRealtimeCleanupResult> {
    return this.#enqueue(() => {
      assertInstanceRealtimeCleanupOptions(options);
      return cleanupGtfsRealtime({
        database: this.#database,
        ...options,
        reporting: this.#resolvedConfig.reporting,
        ...(this.sourceIds === null ? {} : { sourceIds: this.sourceIds }),
        extensions: this.extensions,
      });
    });
  }

  #runRealtimeRefresh(...args: readonly unknown[]): Promise<GtfsImportResult> {
    return this.#enqueueConfigured(
      () =>
        resolveInstanceRefreshOptions(
          this.#resolvedConfig,
          this.sourceIds,
          args,
        ),
      (resolved) =>
        refreshGtfsRealtimeOnConnection({
          resolved,
          connection:
            this.#sqlite === null
              ? { database: this.#database }
              : { sqlite: this.#sqlite },
          databaseDescription: this.#databaseDescription,
        }),
    );
  }

  close(): Promise<void> {
    if (this.#closePromise !== null) {
      return this.#closePromise;
    }
    if (this.#state === 'closed') {
      return Promise.resolve();
    }

    this.#state = 'closing';
    this.#closePromise = Promise.resolve()
      .then(() =>
        withDatabaseCleanup(
          async () => {
            const streams = await Promise.allSettled(
              [...this.#activeStreams].map((stream) => stream.return?.()),
            );
            for (const stream of streams) {
              if (stream.status === 'rejected') {
                throw stream.reason;
              }
            }
          },
          async () => {
            await this.#operationTail;
            await closeOwnedGtfsConnection({
              database: this.#database,
              sqlite: this.#sqlite,
              ownership: this.database.ownership,
            });
          },
        ),
      )
      .finally(() => {
        this.#state = 'closed';
      });
    return this.#closePromise;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }

  #assertDatabaseAvailable(mode: 'read' | 'exclusive' = 'exclusive'): void {
    if (this.#state !== 'active') {
      throw closedInstanceError();
    }
    if (
      this.#activeStreams.size > 0 &&
      (mode === 'exclusive' || !this.#parallelReads)
    ) {
      throw createGtfsQueryError(
        'Finish or close the active query iterator before starting another database operation on this instance',
        {
          reason: 'STREAM_ACTIVE',
        },
      );
    }
  }

  #enqueue<Result>(
    operation: () => Result | Promise<Result>,
    mode: 'read' | 'exclusive' = 'exclusive',
  ): Promise<Result> {
    try {
      this.#assertDatabaseAvailable(mode);
    } catch (error) {
      return Promise.reject(error);
    }

    const parallel = mode === 'read' && this.#parallelReads;
    const preceding = parallel ? this.#exclusiveTail : this.#operationTail;
    const result = preceding.then(operation);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    if (parallel) {
      // Every read waits for the previous writer, but not for its sibling reads.
      this.#operationTail = Promise.all([this.#operationTail, settled]).then(
        () => undefined,
      );
    } else {
      // Later reads must wait for this writer, including all earlier reads.
      this.#exclusiveTail = settled;
      this.#operationTail = settled;
    }
    return result;
  }

  #streamDatabase<Row>(
    callback: (database: Kysely<DB>) => AsyncIterable<Row>,
  ): AsyncIterableIterator<Row> {
    async function* rows(this: GtfsInstance<DB>) {
      this.#assertDatabaseAvailable('read');
      const ready = createCompletionSignal();
      const released = createCompletionSignal();
      // Reserve a read until the cursor closes, not just until it opens.
      const operation = this.#enqueue(async () => {
        ready.complete();
        await released.promise;
      }, 'read');
      this.#activeStreams.add(iterator);
      try {
        await Promise.race([ready.promise, operation]);
        if (this.#state !== 'active') {
          throw closedInstanceError();
        }
        yield* callback(this.#database);
      } finally {
        released.complete();
        await operation;
        this.#activeStreams.delete(iterator);
      }
    }
    const iterator = rows.call(this);
    return iterator;
  }

  #installRepositoryProperties(): void {
    const nestedRepositories: Record<string, Record<string, unknown>> = {
      realtime: {
        refresh: (...args: readonly unknown[]) =>
          this.#runRealtimeRefresh(...args),
        cleanup: (options: GtfsInstanceRealtimeCleanupOptions = {}) =>
          this.#runRealtimeCleanup(options),
      },
    };
    for (const definition of generatedRepositoryDefinitions) {
      const repository = createGtfsRepository<DB>({
        databaseStream: (callback) => this.#streamDatabase(callback),
        databaseOperation: (callback) => this.#readDatabase(callback),
        dialect: this.database.dialect,
        sourceIds: this.sourceIds,
        enabledExtensions: this.extensions,
        table: compiledTableRegistry[definition.registryKey],
      });
      const [rootProperty, ...nestedPath] = definition.propertyPath;
      let target = (nestedRepositories[rootProperty] ??= {});
      for (const property of nestedPath.slice(0, -1)) {
        target = (target[property] ??= {}) as Record<string, unknown>;
      }
      const repositoryProperty = nestedPath.at(-1);
      if (repositoryProperty === undefined) {
        throw new Error(
          `Generated repository ${definition.registryKey} has no property name`,
        );
      }
      target[repositoryProperty] = repository;
    }

    const freezeNestedRepositories = (
      value: Record<string, unknown>,
    ): Readonly<Record<string, unknown>> => {
      for (const child of Object.values(value)) {
        if (child !== null && typeof child === 'object' && !('all' in child)) {
          freezeNestedRepositories(child as Record<string, unknown>);
        }
      }
      return Object.freeze(value);
    };
    for (const [property, repositories] of Object.entries(nestedRepositories)) {
      Object.defineProperty(this, property, {
        value: freezeNestedRepositories(repositories),
        enumerable: true,
      });
    }
  }
}

/** Public instance type, including every generated repository property. */
export type Gtfs<DB = GtfsDatabase> = GtfsInstance<DB> &
  Omit<GtfsRepositoryProperties, 'realtime'> & {
    readonly realtime: GtfsRepositoryProperties['realtime'] &
      GtfsRealtimeOperations;
  };

interface GtfsConstructor {
  new <DB = GtfsDatabase>(options: GtfsInstanceOptions<DB>): Gtfs<DB>;
}

/** Public instance constructor with generated repository properties. */
export const Gtfs = GtfsInstance as unknown as GtfsConstructor;
