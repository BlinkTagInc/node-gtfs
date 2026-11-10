import { defineGtfsDomainTable } from '../../domain-table.ts';

export const bookingRules = defineGtfsDomainTable({
  filename: 'booking_rules.txt',
  tableName: 'booking_rules',
  specification: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['booking_rule_id'],
  fields: {
    booking_rule_id: {
      kind: 'id',
      presence: 'required',
    },
    booking_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 2,
    },
    prior_notice_duration_min: {
      kind: 'integer',
      presence: 'conditionally-required',
    },
    prior_notice_duration_max: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
    },
    prior_notice_last_day: {
      kind: 'integer',
      presence: 'conditionally-required',
    },
    prior_notice_last_time: {
      kind: 'time',
      presence: 'conditionally-required',
    },
    prior_notice_start_day: {
      kind: 'integer',
      presence: 'conditionally-forbidden',
    },
    prior_notice_start_time: {
      kind: 'time',
      presence: 'conditionally-required',
    },
    prior_notice_service_id: {
      kind: 'id',
      presence: 'conditionally-forbidden',
      references: [
        { targetFilename: 'calendar.txt', targetField: 'service_id' },
      ],
    },
    message: { kind: 'text', supportsCaseInsensitiveComparison: true },
    pickup_message: { kind: 'text', supportsCaseInsensitiveComparison: true },
    drop_off_message: { kind: 'text', supportsCaseInsensitiveComparison: true },
    phone_number: { kind: 'text', supportsCaseInsensitiveComparison: true },
    info_url: { kind: 'text' },
    booking_url: { kind: 'text' },
  },
});
