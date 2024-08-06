export const feedInfo = {
  filenameBase: 'feed_info',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'feed_publisher_name',
      type: 'text',
      required: true,
      nocase: true,
    },
    {
      name: 'feed_publisher_url',
      type: 'text',
      required: true,
    },
    {
      name: 'feed_lang',
      type: 'text',
      required: true,
    },
    {
      name: 'default_lang',
      type: 'text',
      nocase: true,
    },
    {
      name: 'feed_start_date',
      type: 'date',
    },
    {
      name: 'feed_end_date',
      type: 'date',
    },
    {
      name: 'feed_version',
      type: 'text',
    },
    {
      name: 'feed_contact_email',
      type: 'text',
      nocase: true,
    },
    {
      name: 'feed_contact_url',
      type: 'text',
    },
  ],
};
