/**
 * Renders public field and repository reference pages from schema/query
 * metadata. Called by generate-schema-artifacts.mjs, including in check mode.
 */
import assert from 'node:assert/strict';
import { format, resolveConfig } from 'prettier';
import { gtfsSpecifications } from '../../src/schema/define-table.ts';
import {
  gtfsManifest,
  gtfsScheduleReferenceRevision,
} from '../../src/schema/manifest.ts';
import { compiledTableRegistry } from '../../src/schema/table-registry.ts';
import { generatedRepositoryDefinitions } from '../../src/generated/repositories.ts';
import { repositoryQueryExtensions } from '../../src/schema/repository-query-extensions.ts';

const labels = {
  'gtfs-schedule': 'GTFS Schedule',
  'gtfs-realtime': 'GTFS-Realtime',
  'gtfs-plus': 'GTFS+',
  'gtfs-ride': 'GTFS-Ride',
  'gtfs-to-html': 'GTFS-to-HTML',
  tods: 'TODS',
  tides: 'TIDES',
};
const repositories = new Map(
  generatedRepositoryDefinitions.map(({ registryKey, propertyPath }) => [
    compiledTableRegistry[registryKey].tableName,
    `gtfs.${propertyPath.join('.')}`,
  ]),
);

function code(value) {
  return `\`${String(value).replaceAll('|', '\\|')}\``;
}

function conditionText(condition) {
  return Object.hasOwn(condition, 'equals')
    ? `${code(condition.field)} = ${code(JSON.stringify(condition.equals))}`
    : `${code(condition.field)} in ${condition.in.map((value) => code(JSON.stringify(value))).join(', ')}`;
}

function valueType(field) {
  if (field.monetary) {
    return 'decimal string';
  }
  if (field.kind === 'enumeration') {
    return typeof field.values[0] === 'number' ? 'number' : 'string';
  }
  return {
    id: 'string',
    text: 'string',
    integer: 'number',
    real: 'number',
    date: 'number (YYYYMMDD)',
    time: 'string (HH:MM:SS)',
    json: 'JSON string',
  }[field.kind];
}

function fieldRules(field) {
  const rules = [];
  if (field.defaultValue !== undefined) {
    rules.push(`Default: ${code(JSON.stringify(field.defaultValue))}.`);
  }
  if (field.kind === 'enumeration') {
    rules.push(
      `${field.closed ? 'Allowed' : 'Known'} values: ${field.values.map((value) => code(JSON.stringify(value))).join(', ')}.`,
    );
  }
  if (field.minimum !== undefined) {
    rules.push(`Minimum: ${code(field.minimum)}.`);
  }
  if (field.maximum !== undefined) {
    rules.push(`Maximum: ${code(field.maximum)}.`);
  }
  if (field.monetary) {
    rules.push(
      `Currency: ${code(field.monetary.currencyField)}; stored as integer minor units.`,
    );
  }
  if (field.supportsCaseInsensitiveComparison) {
    rules.push('Supports case-insensitive comparison.');
  }
  return rules.join(' ') || '—';
}

function renderTable(table) {
  const repository = repositories.get(table.tableName);
  if (!repository) {
    throw new Error(`No repository for ${table.tableName}`);
  }
  const lines = [
    `## ${table.tableName}`,
    '',
    `Repository: ${code(repository)}. Database table: ${code(table.tableName)}.`,
    '',
  ];
  if (table.filename) {
    lines.push(
      `File: ${code(table.filename)} (${table.presence.replaceAll('-', ' ')}).`,
      '',
    );
  }
  lines.push(
    `Primary key: ${table.primaryKey.map(code).join(', ') || 'none'}.`,
    '',
  );
  if (table.filename === 'locations.geojson') {
    lines.push(
      'Each feature becomes one row: `id` comes from the feature ID, `stop_name` and `stop_desc` from its properties, and `geometry` is a JSON string.',
      '',
    );
  }
  lines.push(
    '### Fields',
    '',
    '| Field | Returned value | Presence | Defaults and value rules |',
    '| --- | --- | --- | --- |',
    '| `source_id` | string | required | Source identity added by node-GTFS. |',
  );
  for (const [name, field] of Object.entries(table.fields)) {
    lines.push(
      `| ${code(name)} | ${valueType(field)}${field.presence === 'required' ? '' : ' or null'} | ${(field.presence ?? 'optional').replaceAll('-', ' ')} | ${fieldRules(field)} |`,
    );
  }
  lines.push(
    '',
    `Returned without ${code('select()')}: ${table.defaultSelectedFields.map(code).join(', ')}.`,
    '',
  );
  const derived = Object.entries(table.derivedFields);
  if (derived.length > 0) {
    lines.push(
      '### Selectable derived fields',
      '',
      'These fields require an explicit `select()` and an enabled generated-column schema.',
      '',
      '| Field | Derived from | Returned value | Selected by default |',
      '| --- | --- | --- | --- |',
    );
    for (const [name, field] of derived) {
      const source = table.fields[field.sourceField];
      lines.push(
        `| ${code(name)} | ${code(field.sourceField)} | number${source.presence === 'required' ? '' : ' or null'}; service-day seconds | ${field.selectedByDefault ? 'yes' : 'no'} |`,
      );
    }
    lines.push('');
  }
  const references = Object.entries(table.fields).flatMap(([name, field]) =>
    (field.references ?? []).map((reference) => [name, reference]),
  );
  if (references.length > 0) {
    lines.push(
      '### References',
      '',
      'References are checked within the same source. A match in any applicable target is sufficient; a condition limits which targets apply. These are not database foreign keys.',
      '',
      '| Field | Target file and field | Applies when |',
      '| --- | --- | --- |',
    );
    for (const [name, reference] of references) {
      lines.push(
        `| ${code(name)} | ${code(reference.targetFilename)} → ${code(reference.targetField)} | ${reference.when ? conditionText(reference.when) : 'always'} |`,
      );
    }
    lines.push('');
  }
  if (table.constraints.length > 0) {
    lines.push('### Cross-field rules', '');
    for (const constraint of table.constraints) {
      if (constraint.kind === 'range') {
        lines.push(
          `- ${code(constraint.endField)} must be ${constraint.allowEqual ? 'at least' : 'greater than'} ${code(constraint.startField)}.`,
        );
      } else {
        lines.push(
          `- ${code(constraint.field)} is ${constraint.presence} when ${conditionText(constraint.when)}.`,
        );
      }
    }
    lines.push('');
  }
  const filters = Object.entries(
    repositoryQueryExtensions[table.tableName] ?? {},
  );
  if (filters.length > 0) {
    lines.push(
      '### Query filters',
      '',
      'Use these with the [equality and semantic filter syntax](../query-filters.md).',
      '',
    );
    for (const [name, filter] of filters) {
      const type = {
        date: 'service date (YYYYMMDD)',
        timestamp: 'Unix seconds',
        bounds: '`{ south, west, north, east }`',
      }[filter.kind];
      lines.push(`- ${code(name)}: ${type}.`);
    }
    if (filters.length > 0) {
      lines.push('');
    }
  }
  return lines.join('\n');
}

export async function renderFieldReferences() {
  assert.deepEqual(
    Object.keys(labels),
    gtfsSpecifications.filter((name) => name !== 'tods-v1'),
    'Add a public reference page for each specification',
  );
  const artifacts = new Map();
  const formatting = await resolveConfig(
    new URL('../../docs/data-model.md', import.meta.url),
  );
  for (const [specification, label] of Object.entries(labels)) {
    const tables = Object.values(gtfsManifest).filter(
      (table) => table.specification === specification,
    );
    const lines = [
      '<!-- Generated by scripts/generate-schema-artifacts.mjs. Do not edit by hand. -->',
      `# ${label} field reference`,
      '',
      '[All guides](../README.md) · [Files, fields, and data types](../data-model.md) · [Query basics](../queries.md)',
      '',
      'This page lists supported fields and repository results. See [row representations](../data-model.md#row-representations) for source values, database storage, and explicit selection.',
      '',
    ];
    if (specification === 'gtfs-schedule') {
      lines.push(
        `Schedule metadata targets the [GTFS reference](https://gtfs.org/documentation/schedule/reference/) revised ${gtfsScheduleReferenceRevision}. For full field meanings and conditional requirements, consult that reference.`,
        '',
      );
    }
    if (specification === 'gtfs-realtime') {
      lines.push(
        'These are flattened records and retained message history, not CSV files or the original protobuf message shape. See [GTFS-Realtime](../realtime.md) for entity relationships and raw payloads.',
        '',
      );
    }
    lines.push('| File or table | Repository |', '| --- | --- |');
    for (const table of tables) {
      lines.push(
        `| [${code(table.filename ?? table.tableName)}](#${table.tableName}) | ${code(repositories.get(table.tableName))} |`,
      );
    }
    lines.push('', ...tables.map(renderTable));
    lines.push('', '## Next steps', '');
    if (specification === 'gtfs-realtime') {
      lines.push(
        '- [Configure refreshes and retention](../realtime.md).',
        '- [Filter active alerts](../query-filters.md#gtfs-realtime-active-periods).',
        '- [Join entities using source and GTFS-Realtime feed keys](../sql-queries.md#joining-related-records).',
        '- [Inspect notices and errors](../reporting.md).',
      );
    } else {
      if (specification !== 'gtfs-schedule') {
        lines.push(
          '- [Enable this extension](../extensions.md#enable-explicitly).',
        );
      } else {
        lines.push(
          '- [Validate static GTFS feed fields and references](../validation.md).',
        );
      }
      lines.push(
        '- [Import or replace a static GTFS feed](../import.md).',
        '- [Select fields and filter records](../queries.md).',
        '- [Join related records](../sql-queries.md#joining-related-records).',
        '- [Export populated files](../export.md#which-data-is-exported).',
      );
    }
    artifacts.set(
      `docs/reference/${specification}.md`,
      await format(lines.join('\n'), { ...formatting, parser: 'markdown' }),
    );
  }
  return artifacts;
}
