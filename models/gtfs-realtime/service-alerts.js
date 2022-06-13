const model = {
  filenameBase: 'service_alerts',
  extension: 'gtfs-realtime',
  schema: [
    {
      name: 'id',
      type: 'varchar(255)',
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
      type: 'varchar(255)',
      required: true,
      source: 'alert.activePeriod[0].start',
      default: '',
    },
    {
      name: 'end_time',
      type: 'varchar(255)',
      required: true,
      source: 'alert.activePeriod[0].end',
      default: '',
    },
    {
      name: 'headline',
      type: 'varchar(2048)',
      required: true,
      source: 'alert.headerText.translation[0].text',
      default: '',
    },
    {
      name: 'description',
      type: 'varchar(4096)',
      required: true,
      source: 'alert.descriptionText.translation[0].text',
      default: '',
    },
    {
      name: 'isUpdated',
      type: 'integer',
      required: true,
      min: 0,
      max: 1,
      default: 1,
    },
  ],
};

export default model;
