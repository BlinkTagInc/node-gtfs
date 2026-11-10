import type Database from 'better-sqlite3';
import type { Kysely } from 'kysely';

import {
  applyKyselyGtfsIndexPlan,
  applyKyselyGtfsTablePlan,
} from './kysely/schema-writer.ts';
import {
  assertCompatibleGtfsSchema,
  type GtfsSchemaInspection,
} from './schema-lifecycle.ts';
import {
  applySqliteGtfsIndexPlan,
  applySqliteGtfsTablePlan,
} from './sqlite/schema-writer.ts';
import type { GtfsStoragePlan } from './storage/plan.ts';

export async function executeGtfsSchemaPlan<DB>(options: {
  database: Kysely<DB>;
  sqlite: Database.Database | null;
  storagePlan: GtfsStoragePlan;
}): Promise<GtfsSchemaInspection> {
  const { database, sqlite, storagePlan } = options;
  const context = {
    database: sqlite ?? database,
    dialect: storagePlan.dialect,
  };
  if (sqlite !== null) {
    const tableInspection = applySqliteGtfsTablePlan(sqlite, storagePlan);
    if (storagePlan.mode === 'validate') {
      return tableInspection;
    }
    if (storagePlan.mode === 'ensure') {
      await assertCompatibleGtfsSchema(tableInspection, context);
    }
    const inspection = applySqliteGtfsIndexPlan(sqlite, storagePlan);
    if (storagePlan.mode === 'ensure') {
      await assertCompatibleGtfsSchema(inspection, context);
    }
    return inspection;
  }

  const tableInspection = await applyKyselyGtfsTablePlan(database, storagePlan);
  if (storagePlan.mode === 'validate') {
    return tableInspection;
  }
  if (storagePlan.mode === 'ensure') {
    await assertCompatibleGtfsSchema(tableInspection, context);
  }
  const inspection = await applyKyselyGtfsIndexPlan(database, storagePlan);
  if (storagePlan.mode === 'ensure') {
    await assertCompatibleGtfsSchema(inspection, context);
  }
  return inspection;
}
