const model = {
  filenameBase: 'booking_rules',
  schema: [
    {
      name: 'booking_rule_id',
      type: 'varchar(255)',
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
      type: 'varchar(255)',
    },
    {
      name: 'prior_notice_last_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'prior_notice_start_day',
      type: 'integer',
      min: 0,
    },
    {
      name: 'prior_notice_start_time',
      type: 'varchar(255)',
    },
    {
      name: 'prior_notice_start_timestamp',
      type: 'integer',
      index: true,
    },
    {
      name: 'prior_notice_service_id',
      type: 'varchar(255)',
      prefix: true,
    },
    {
      name: 'message',
      type: 'varchar(2047)',
      nocase: true,
    },
    {
      name: 'pickup_message',
      type: 'varchar(2047)',
      nocase: true,
    },
    {
      name: 'drop_off_message',
      type: 'varchar(2047)',
      nocase: true,
    },
    {
      name: 'phone_number',
      type: 'varchar(64)',
      nocase: true,
    },
    {
      name: 'info_url',
      type: 'varchar(2047)',
    },
    {
      name: 'booking_url',
      type: 'varchar(2047)',
    },
  ],
};

export default model;
