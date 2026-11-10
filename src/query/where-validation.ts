import { createGtfsQueryError } from '../diagnostics/errors.ts';
import { isPlainObject } from '../config/options.ts';

export function assertDefinedWhereValues(
  where: unknown,
  tableName: string,
): void {
  const ancestors = new Set<object>();
  const visit = (
    value: unknown,
    path: string,
    field?: string,
    depth = 0,
  ): void => {
    if (depth > 100) {
      throw createGtfsQueryError('Filter nesting must not exceed 100 levels', {
        table: tableName,
        path,
        reason: 'filter-depth-exceeded',
      });
    }
    if (value === undefined) {
      const hint =
        path === 'where'
          ? 'omit the option to apply no additional filters'
          : 'use null for a nullable field or omit the property to leave it unfiltered';
      throw createGtfsQueryError(`\`${path}\` must not be undefined; ${hint}`, {
        table: tableName,
        ...(field === undefined ? {} : { field }),
        path,
        reason: 'undefined-filter-value',
      });
    }
    if (!Array.isArray(value) && !isPlainObject(value)) {
      return;
    }
    if (ancestors.has(value)) {
      throw createGtfsQueryError(
        `\`${path}\` must not contain a circular reference`,
        { table: tableName, path, reason: 'circular-filter-value' },
      );
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      // Array iteration includes holes, which must not turn into null predicates.
      for (const [index, item] of value.entries()) {
        visit(item, `${path}[${index}]`, field, depth + 1);
      }
    } else {
      for (const [key, item] of Object.entries(value)) {
        visit(item, `${path}.${key}`, field ?? key, depth + 1);
      }
    }
    ancestors.delete(value);
  };
  visit(where, 'where');
}
