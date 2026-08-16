import { defineGtfsTable } from '../../define-table.ts';

export const operators = defineGtfsTable({
  file: 'operators.txt',
  presence: 'optional',
  primaryKey: ['operator_id'],
  fields: {
    operator_id: { kind: 'id', presence: 'required', applyFeedPrefix: true },
  },
  namespace: 'tides',
});
