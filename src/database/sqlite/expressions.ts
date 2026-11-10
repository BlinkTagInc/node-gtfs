import { quoteSqliteIdentifier } from './identifier.ts';

export function sqliteServiceTimeExpression(sourceColumn: string): string {
  const sourceColumnName = quoteSqliteIdentifier(sourceColumn);
  return `
      CASE
        WHEN ${sourceColumnName} IS NULL OR ${sourceColumnName} = '' THEN NULL
        ELSE CAST(
          substr(${sourceColumnName}, 1, instr(${sourceColumnName}, ':') - 1) * 3600 +
          substr(${sourceColumnName}, instr(${sourceColumnName}, ':') + 1, 2) * 60 +
          substr(${sourceColumnName}, -2) AS INTEGER
        )
      END
    `;
}

// Ignore SQL formatting, but never change the contents of string literals.
export function normalizeSqlExpression(expression: string): string {
  return (expression.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|[^\s'"]+/gu) ?? [])
    .map((token) => (token.startsWith("'") ? token : token.toLowerCase()))
    .join('');
}

export function readSqliteGeneratedExpression(
  ddl: string,
  columnName: string,
): string | null {
  const escaped = quoteSqliteIdentifier(columnName).replace(
    /[.*+?^${}()|[\]\\]/gu,
    '\\$&',
  );
  const start = new RegExp(
    `${escaped}\\s+\\w+\\s+generated\\s+always\\s+as\\s*\\(`,
    'iu',
  ).exec(ddl);
  if (start === null) {
    return null;
  }
  const offset = start.index + start[0].length;
  let depth = 1;
  let quote: string | undefined;
  for (let index = offset; index < ddl.length; index++) {
    const character = ddl[index];
    if (quote !== undefined) {
      if (character === quote) {
        if (ddl[index + 1] === quote) {
          index++;
        } else {
          quote = undefined;
        }
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '(') {
      depth++;
    } else if (character === ')') {
      depth--;
      if (depth === 0) {
        return ddl.slice(offset, index);
      }
    }
  }
  return null;
}
