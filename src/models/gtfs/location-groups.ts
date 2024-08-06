export const locationGroups = {
  filenameBase: 'location_groups',
  filenameExtension: 'txt',
  schema: [
    {
      name: 'location_group_id',
      type: 'text',
      primary: true,
      prefix: true,
    },
    {
      name: 'location_group_name',
      type: 'text',
      nocase: true,
    },
  ],
};
