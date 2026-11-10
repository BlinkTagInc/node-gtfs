import { defineGtfsDomainTable } from '../../domain-table.ts';

export const feedInfo = defineGtfsDomainTable({
  filename: 'feed_info.txt',
  tableName: 'feed_info',
  specification: 'gtfs-schedule',
  presence: 'conditionally-required',
  fields: {
    feed_publisher_name: {
      kind: 'text',
      presence: 'required',
      supportsCaseInsensitiveComparison: true,
    },
    feed_publisher_url: { kind: 'text', presence: 'required' },
    feed_lang: { kind: 'text', presence: 'required' },
    default_lang: { kind: 'text', supportsCaseInsensitiveComparison: true },
    feed_start_date: { kind: 'date', presence: 'recommended' },
    feed_end_date: { kind: 'date', presence: 'recommended' },
    feed_version: { kind: 'text', presence: 'recommended' },
    feed_contact_email: {
      kind: 'text',
      supportsCaseInsensitiveComparison: true,
    },
    feed_contact_url: { kind: 'text' },
  },
});
