import { sql, type Kysely, type QueryResult } from 'kysely';

import {
  GTFS_REALTIME_CLEANUP_TABLES,
  type GtfsRealtimeCleanupTable,
  type ResolvedGtfsRealtimeCleanupOptions,
} from './cleanup-types.ts';
import {
  GTFS_REALTIME_CHILD_RELATIONSHIPS,
  GTFS_REALTIME_CURRENT_PARENT_TABLES,
} from './entity-tables.ts';

interface ChildTableCleanup {
  readonly child: GtfsRealtimeCleanupTable;
  readonly parent: GtfsRealtimeCleanupTable;
  readonly childExpiration:
    'expires_at_unix_seconds' | 'retention_expires_at_unix_seconds';
  readonly parentExpiration:
    'expires_at_unix_seconds' | 'retention_expires_at_unix_seconds';
  readonly keys: readonly (readonly [
    childColumn: string,
    parentColumn: string,
  ])[];
}

const CURRENT_CHILD_TABLES: readonly ChildTableCleanup[] =
  GTFS_REALTIME_CHILD_RELATIONSHIPS.map(
    ({ child, parent, entityIdColumn }) => ({
      child: child.tableName,
      parent: parent.tableName,
      childExpiration: 'expires_at_unix_seconds',
      parentExpiration: 'expires_at_unix_seconds',
      keys: [
        ['source_id', 'source_id'],
        ['realtime_feed_id', 'realtime_feed_id'],
        [entityIdColumn, 'entity_id'],
      ],
    }),
  );

const HISTORY_CHILD_TABLE: ChildTableCleanup = {
  child: 'realtime_feed_entities',
  parent: 'realtime_snapshots',
  childExpiration: 'retention_expires_at_unix_seconds',
  parentExpiration: 'retention_expires_at_unix_seconds',
  keys: [
    ['source_id', 'source_id'],
    ['realtime_feed_id', 'realtime_feed_id'],
    ['snapshot_id', 'snapshot_id'],
  ],
};

function compileSourceScopeCondition(
  table: string,
  sourceIds: readonly string[] | undefined,
) {
  if (sourceIds === undefined) {
    return sql<boolean>`1 = 1`;
  }
  if (sourceIds.length === 0) {
    return sql<boolean>`1 = 0`;
  }
  return sql<boolean>`${sql.ref(`${table}.source_id`)} in (${sql.join(
    sourceIds,
  )})`;
}

function getAffectedRowCount(result: QueryResult<unknown>): number {
  return Number(result.numAffectedRows ?? 0n);
}

async function deleteExpiredChildren<DB>(
  database: Kysely<DB>,
  {
    table,
    nowUnixSeconds,
    sourceIds,
  }: {
    table: ChildTableCleanup;
    nowUnixSeconds: number;
    sourceIds: readonly string[] | undefined;
  },
): Promise<number> {
  const matchingParent = sql.join(
    table.keys.map(
      ([childColumn, parentColumn]) =>
        sql`${sql.ref(`${table.parent}.${parentColumn}`)} = ${sql.ref(
          `${table.child}.${childColumn}`,
        )}`,
    ),
    sql` and `,
  );
  const result = await sql`
    delete from ${sql.table(table.child)}
    where ${compileSourceScopeCondition(table.child, sourceIds)}
      and (
        ${sql.ref(`${table.child}.${table.childExpiration}`)} <= ${nowUnixSeconds}
        or not exists (
          select 1 from ${sql.table(table.parent)}
          where ${matchingParent}
            and (
              ${sql.ref(`${table.parent}.${table.parentExpiration}`)} is null
              or ${sql.ref(`${table.parent}.${table.parentExpiration}`)} > ${nowUnixSeconds}
            )
        )
      )
  `.execute(database);
  return getAffectedRowCount(result);
}

async function deleteExpiredParents<DB>(
  database: Kysely<DB>,
  {
    table,
    expirationColumn,
    nowUnixSeconds,
    sourceIds,
  }: {
    table: GtfsRealtimeCleanupTable;
    expirationColumn:
      'expires_at_unix_seconds' | 'retention_expires_at_unix_seconds';
    nowUnixSeconds: number;
    sourceIds: readonly string[] | undefined;
  },
): Promise<number> {
  const result = await sql`
    delete from ${sql.table(table)}
    where ${compileSourceScopeCondition(table, sourceIds)}
      and ${sql.ref(`${table}.${expirationColumn}`)} is not null
      and ${sql.ref(`${table}.${expirationColumn}`)} <= ${nowUnixSeconds}
  `.execute(database);
  return getAffectedRowCount(result);
}

/** Executes all selected Realtime deletes in one portable transaction. */
export async function executeGtfsRealtimeCleanupTransaction<DB>(
  database: Kysely<DB>,
  options: ResolvedGtfsRealtimeCleanupOptions,
): Promise<Record<GtfsRealtimeCleanupTable, number>> {
  const deletedRowsByTable = Object.fromEntries(
    GTFS_REALTIME_CLEANUP_TABLES.map((table) => [table, 0]),
  ) as Record<GtfsRealtimeCleanupTable, number>;

  await database.transaction().execute(async (transaction) => {
    if (options.currentState) {
      for (const childTable of CURRENT_CHILD_TABLES) {
        deletedRowsByTable[childTable.child] = await deleteExpiredChildren(
          transaction,
          {
            table: childTable,
            nowUnixSeconds: options.nowUnixSeconds,
            sourceIds: options.sourceIds,
          },
        );
      }
      for (const parentTable of GTFS_REALTIME_CURRENT_PARENT_TABLES) {
        deletedRowsByTable[parentTable] = await deleteExpiredParents(
          transaction,
          {
            table: parentTable,
            expirationColumn: 'expires_at_unix_seconds',
            nowUnixSeconds: options.nowUnixSeconds,
            sourceIds: options.sourceIds,
          },
        );
      }
    }

    if (options.snapshotHistory) {
      deletedRowsByTable.realtime_feed_entities = await deleteExpiredChildren(
        transaction,
        {
          table: HISTORY_CHILD_TABLE,
          nowUnixSeconds: options.nowUnixSeconds,
          sourceIds: options.sourceIds,
        },
      );
      deletedRowsByTable.realtime_snapshots = await deleteExpiredParents(
        transaction,
        {
          table: 'realtime_snapshots',
          expirationColumn: 'retention_expires_at_unix_seconds',
          nowUnixSeconds: options.nowUnixSeconds,
          sourceIds: options.sourceIds,
        },
      );
    }
  });

  return deletedRowsByTable;
}
