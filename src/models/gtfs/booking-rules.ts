export const bookingRules = {
  filenameBase: 'booking_rules',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'booking_rule_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'booking_type',
      type: 'integer',
      required: true,
      min: 0,
      max: 2,
    },
    {
      name: 'prior_notice_duration_min',
      type: 'integer',
      min: 0,
    },
    {
      name: 'prior_notice_duration_max',
      type: 'integer',
      min: 0,
    },
    {
      name: 'prior_notice_last_day',
      type: 'integer',
      min: 0,
    },
    {
      name: 'prior_notice_last_time',
      type: 'time',
    },
    {
      name: 'prior_notice_start_day',
      type: 'integer',
      min: 0,
    },
    {
      name: 'prior_notice_start_time',
      type: 'time',
    },
    {
      name: 'prior_notice_service_id',
      type: 'text',
      prefix: true,
    },
    {
      name: 'message',
      type: 'text',
      nocase: true,
    },
    {
      name: 'pickup_message',
      type: 'text',
      nocase: true,
    },
    {
      name: 'drop_off_message',
      type: 'text',
      nocase: true,
    },
    {
      name: 'phone_number',
      type: 'text',
      nocase: true,
    },
    {
      name: 'info_url',
      type: 'text',
    },
    {
      name: 'booking_url',
      type: 'text',
    },
  ],
};
