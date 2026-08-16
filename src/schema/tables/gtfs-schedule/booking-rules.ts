import { defineGtfsTable } from '../../define-table.ts';

export const bookingRules = defineGtfsTable({
  file: 'booking_rules.txt',
  namespace: 'gtfs-schedule',
  presence: 'optional',
  primaryKey: ['booking_rule_id'],
  fields: {
    booking_rule_id: {
      kind: 'id',
      presence: 'required',
      applyFeedPrefix: true,
    },
    booking_type: {
      kind: 'integer',
      presence: 'required',
      minimum: 0,
      maximum: 2,
    },
    prior_notice_duration_min: { kind: 'integer' },
    prior_notice_duration_max: { kind: 'integer' },
    prior_notice_last_day: { kind: 'integer' },
    prior_notice_last_time: { kind: 'time' },
    prior_notice_start_day: { kind: 'integer' },
    prior_notice_start_time: { kind: 'time' },
    prior_notice_service_id: {
      kind: 'id',
      references: [{ file: 'calendar.txt', field: 'service_id' }],
      applyFeedPrefix: true,
    },
    message: { kind: 'text', caseInsensitiveComparison: true },
    pickup_message: { kind: 'text', caseInsensitiveComparison: true },
    drop_off_message: { kind: 'text', caseInsensitiveComparison: true },
    phone_number: { kind: 'text', caseInsensitiveComparison: true },
    info_url: { kind: 'text' },
    booking_url: { kind: 'text' },
  },
  storage: {
    indexes: ['prior_notice_last_timestamp', 'prior_notice_start_timestamp'],
  },
});
