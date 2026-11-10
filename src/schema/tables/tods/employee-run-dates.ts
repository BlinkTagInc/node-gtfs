import { defineGtfsDomainTable } from '../../domain-table.ts';

export const employeeRunDates = defineGtfsDomainTable({
  filename: 'employee_run_dates.txt',
  tableName: 'employee_run_dates',
  specification: 'tods',
  presence: 'optional',
  primaryKey: ['date', 'service_id', 'run_id', 'employee_id'],
  fields: {
    date: { kind: 'date', presence: 'required' },
    service_id: {
      kind: 'id',
      presence: 'required',
      references: [
        { targetFilename: 'run_events.txt', targetField: 'service_id' },
      ],
    },
    run_id: {
      kind: 'id',
      presence: 'required',
      references: [{ targetFilename: 'run_events.txt', targetField: 'run_id' }],
    },
    employee_id: { kind: 'id', presence: 'required' },
  },
});
