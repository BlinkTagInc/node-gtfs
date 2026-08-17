import Database from 'better-sqlite3';

import type {
  GtfsRealtimeWriter,
  NormalizedRealtimeRow,
  RealtimeMutation,
} from './gtfs-realtime-writer.ts';
import { escapeIdentifier } from './utils.ts';

function rowValues(
  mutation: Extract<RealtimeMutation, { operation: 'replace' }>,
): NormalizedRealtimeRow[keyof NormalizedRealtimeRow][] {
  return mutation.table.columns.map(
    (column) => mutation.row[column.name] ?? null,
  );
}

export function createSqliteGtfsRealtimeWriter(
  db: Database.Database,
): GtfsRealtimeWriter {
  const replaceStatements = new Map<string, Database.Statement>();
  const deleteStatements = new Map<string, Database.Statement>();

  function runMutation(mutation: RealtimeMutation): void {
    if (mutation.operation === 'replace') {
      let statement = replaceStatements.get(mutation.table.name);
      if (!statement) {
        const columns = mutation.table.columns.map((column) => column.name);
        statement = db.prepare(
          `REPLACE INTO ${escapeIdentifier(mutation.table.name)} (${columns
            .map(escapeIdentifier)
            .join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        );
        replaceStatements.set(mutation.table.name, statement);
      }
      statement.run(rowValues(mutation));
      return;
    }

    const cacheKey = `${mutation.table.name}:${mutation.where
      .map(({ field, nullSafe }) => `${field}:${Boolean(nullSafe)}`)
      .join(',')}`;
    let statement = deleteStatements.get(cacheKey);
    if (!statement) {
      const whereClause = mutation.where
        .map(
          ({ field, nullSafe }) =>
            `${escapeIdentifier(field)} ${nullSafe ? 'IS' : '='} ?`,
        )
        .join(' AND ');
      statement = db.prepare(
        `DELETE FROM ${escapeIdentifier(mutation.table.name)} WHERE ${whereClause}`,
      );
      deleteStatements.set(cacheKey, statement);
    }
    statement.run(mutation.where.map(({ value }) => value));
  }

  const writeTransaction = db.transaction(
    (entities: Parameters<GtfsRealtimeWriter['writeEntities']>[0]) => {
      let recordCount = 0;
      const errors: unknown[] = [];

      for (const entity of entities) {
        try {
          for (const mutation of entity.mutations) {
            runMutation(mutation);
            if (mutation.operation === 'replace') recordCount += 1;
          }
        } catch (error: unknown) {
          errors.push(error);
        }
      }

      return { recordCount, errors };
    },
  );

  return {
    writeEntities(entities) {
      return writeTransaction(entities);
    },
  };
}
