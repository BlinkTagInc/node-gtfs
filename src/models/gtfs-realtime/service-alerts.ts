export const serviceAlerts = {
  filenameBase: 'service_alerts',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'id',
      type: 'text',
      required: true,
      primary: true,
      index: true,
      source: 'id',
      prefix: true,
    },
    {
      name: 'active_period',
      type: 'json',
      source: 'alert.activePeriod',
    },
    {
      name: 'cause',
      type: 'text',
      source: 'alert.cause',
    },
    {
      name: 'effect',
      type: 'text',
      source: 'alert.effect',
    },
    {
      name: 'url',
      type: 'text',
      source: 'alert.url.translation[0].text',
      default: '',
    },
    {
      name: 'start_time',
      type: 'text',
      required: true,
      source: 'alert.activePeriod[0].start',
      default: '',
    },
    {
      name: 'end_time',
      type: 'text',
      required: true,
      source: 'alert.activePeriod[0].end',
      default: '',
    },
    {
      name: 'header_text',
      type: 'text',
      required: true,
      source: 'alert.headerText.translation[0].text',
      default: '',
    },
    {
      name: 'description_text',
      type: 'text',
      required: true,
      source: 'alert.descriptionText.translation[0].text',
      default: '',
    },
    {
      name: 'tts_header_text',
      type: 'text',
      source: 'alert.ttsHeaderText.translation[0].text',
    },
    {
      name: 'tts_description_text',
      type: 'text',
      source: 'alert.ttsDescriptionText.translation[0].text',
    },
    {
      name: 'severity_level',
      type: 'text',
      source: 'alert.severityLevel',
    },
    {
      name: 'created_timestamp',
      type: 'integer',
      required: true,
    },
    {
      name: 'expiration_timestamp',
      type: 'integer',
      required: true,
    },
  ],
};
