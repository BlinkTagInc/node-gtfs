import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import {
  Kysely,
  MysqlQueryCompiler,
  PostgresQueryCompiler,
  SqliteDialect,
  sql,
} from 'kysely';

import { compileNullSafeKeyMembership } from '../../src/query/key-membership.ts';

test('key membership is two-valued for nullable source and target keys, including negation', async (t) => {
  const sqlite = new Database(':memory:');
  const database = new Kysely({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  t.after(() => database.destroy());
  sqlite.exec(`
    create table source_keys (ordinal integer, source_id text, entity_id text, child_id text);
    create table target_keys (source_id text, entity_id text, child_id text, enabled integer);
  `);
  const sourceKeys = [
    ['north', 'match', 'first'],
    ['north', 'match', 'second'],
    ['south', 'match', 'first'],
    ['north', 'remote', 'first'],
    ['south', 'remote', 'first'],
    ['north', 'missing', 'first'],
    ['north', 'excluded', 'first'],
    ['north', null, 'first'],
    [null, 'match', 'first'],
    ['north', 'match', null],
    [null, null, null],
  ] as const;
  const populatedTargets = [
    ['north', 'match', 'first', 1],
    ['south', 'remote', 'first', 1],
    ['north', null, 'first', 1],
    [null, 'missing', 'first', 1],
    ['north', 'missing', null, 1],
    [null, null, null, 1],
    ['north', 'excluded', 'first', 0],
  ] as const;
  const insertSource = sqlite.prepare(
    'insert into source_keys values (?, ?, ?, ?)',
  );
  const insertTarget = sqlite.prepare(
    'insert into target_keys values (?, ?, ?, ?)',
  );
  for (const [index, key] of sourceKeys.entries()) {
    insertSource.run(index, ...key);
  }
  for (const [name, targets] of [
    ['populated', populatedTargets],
    ['only NULL keys', [[null, null, null, 1]]],
    ['empty', []],
  ] as const) {
    for (const keyWidth of [1, 2, 3]) {
      await t.test(`${name}, ${keyWidth}-column key`, () => {
        sqlite.exec('delete from target_keys');
        for (const target of targets) {
          insertTarget.run(...target);
        }
        const membership = compileNullSafeKeyMembership({
          columns: ['source_id', 'entity_id', 'child_id']
            .slice(0, keyWidth)
            .map((field) => ({
              source: sql.ref(`origin.${field}`),
              target: sql.ref(`candidate.${field}`),
            })),
          from: sql`target_keys as candidate`,
          where: sql<boolean>`candidate.enabled = ${1}`,
        });
        const query = sql`
          select origin.ordinal,
            ${membership} as matched,
            not (${membership}) as unmatched,
            not (not (${membership})) as double_negated
          from source_keys as origin order by origin.ordinal
        `.compile(database);
        assert.deepEqual(
          sqlite.prepare(query.sql).all(query.parameters),
          sourceKeys.map((sourceKey, ordinal) => {
            const matched = Number(
              targets.some(
                (target) =>
                  target[3] === 1 &&
                  sourceKey
                    .slice(0, keyWidth)
                    .every(
                      (value, index) =>
                        value !== null && value === target[index],
                    ),
              ),
            );
            return {
              ordinal,
              matched,
              unmatched: 1 - matched,
              double_negated: matched,
            };
          }),
        );
        for (const compiler of [
          new MysqlQueryCompiler(),
          new PostgresQueryCompiler(),
        ]) {
          const compiled = compiler.compileQuery(query.query, query.queryId);
          assert.deepEqual(compiled.parameters, [1, 1, 1]);
          assert.match(compiled.sql, /in\s*\(\s*select/i);
          assert.doesNotMatch(compiled.sql, /exists|coalesce/i);
          assert.equal(
            compiled.sql.match(/is not null/g)?.length,
            keyWidth * 2 * 3,
          );
        }
      });
    }
  }
});
