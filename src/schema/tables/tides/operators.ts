import { defineGtfsDomainTable } from '../../domain-table.ts';

export const operators = defineGtfsDomainTable({
  filename: 'operators.csv',
  tableName: 'operators',
  presence: 'optional',
  primaryKey: ['operator_id'],
  fields: {
    operator_id: { kind: 'id', presence: 'required' },
  },
  specification: 'tides',
});
