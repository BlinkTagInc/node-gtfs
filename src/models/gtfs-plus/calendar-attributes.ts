export const calendarAttributes = {
  filenameBase: 'calendar_attributes',
  filenameExtension: 'txt',
  nonstandard: true,
  extension: 'gtfs-plus',
  schema: [
    {
      name: 'service_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'service_description',
      type: 'text',
      required: true,
      nocase: true,
    },
  ],
};
