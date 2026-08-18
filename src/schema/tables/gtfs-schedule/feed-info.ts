import { defineGtfsTable } from '../../define-table.ts';

export const feedInfo = defineGtfsTable({
  file: 'feed_info.txt',
  namespace: 'gtfs-schedule',
  presence: 'conditionallyRequired',
  fields: {
    feed_publisher_name: {
      kind: 'text',
      presence: 'required',
      caseInsensitiveComparison: true,
    },
    feed_publisher_url: { kind: 'text', presence: 'required' },
    feed_lang: { kind: 'text', presence: 'required' },
    default_lang: { kind: 'text', caseInsensitiveComparison: true },
    feed_start_date: { kind: 'date', presence: 'recommended' },
    feed_end_date: { kind: 'date', presence: 'recommended' },
    feed_version: { kind: 'text', presence: 'recommended' },
    feed_contact_email: { kind: 'text', caseInsensitiveComparison: true },
    feed_contact_url: { kind: 'text' },
  },
});
