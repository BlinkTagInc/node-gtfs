const model = {
  filenameBase: 'feed_info',
  schema: [
    {
      name: 'feed_publisher_name',
      type: 'varchar(255)',
      required: true,
      nocase: true,
    },
    {
      name: 'feed_publisher_url',
      type: 'varchar(2047)',
      required: true,
    },
    {
      name: 'feed_lang',
      type: 'varchar(255)',
      required: true,
    },
    {
      name: 'default_lang',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'feed_start_date',
      type: 'integer',
    },
    {
      name: 'feed_end_date',
      type: 'integer',
    },
    {
      name: 'feed_version',
      type: 'varchar(255)',
    },
    {
      name: 'feed_contact_email',
      type: 'varchar(255)',
      nocase: true,
    },
    {
      name: 'feed_contact_url',
      type: 'varchar(2047)',
    },
  ],
};

export default model;
