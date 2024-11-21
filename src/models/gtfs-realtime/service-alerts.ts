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
      source: 'alert.url',
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
      name: 'headerText',
      type: 'text',
      required: true,
      source: 'alert.headerText.translation[0].text',
      default: '',
    },
    {
      name: 'descriptionText',
      type: 'text',
      required: true,
      source: 'alert.descriptionText.translation[0].text',
      default: '',
    },
    {
      name: 'ttsHeaderText',
      type: 'text',
      source: 'alert.ttsHeaderText.translation[0].text',
    },
    {
      name: 'ttsDescriptionText',
      type: 'text',
      source: 'alert.ttsDescriptionText.translation[0].text',
    },
    {
      name: 'severityLevel',
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
