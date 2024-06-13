const model = {
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
      type: 'integer',
      required: true,
      min: 0,
      source: 'alert.cause',
      default: 0,
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
      name: 'headline',
      type: 'text',
      required: true,
      source: 'alert.headerText.translation[0].text',
      default: '',
    },
    {
      name: 'description',
      type: 'text',
      required: true,
      source: 'alert.descriptionText.translation[0].text',
      default: '',
    },
    {
      name: 'is_updated',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
      default: 1,
    },
  ],
};

export default model;
