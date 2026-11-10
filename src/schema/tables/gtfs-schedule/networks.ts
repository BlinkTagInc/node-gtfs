import { defineGtfsDomainTable } from '../../domain-table.ts';

export const networks = defineGtfsDomainTable({
  filename: 'networks.txt',
  tableName: 'networks',
  specification: 'gtfs-schedule',
  presence: 'conditionally-forbidden',
  primaryKey: ['network_id'],
  fields: {
    network_id: { kind: 'id', presence: 'required' },
    network_name: { kind: 'text', supportsCaseInsensitiveComparison: true },
  },
});
