import { defineGtfsTable } from '../../define-table.ts';

export const serviceAlerts = defineGtfsTable({
  file: null,
  table: 'service_alerts',
  presence: 'optional',
  primaryKey: ['id'],
  fields: {
    id: {
      kind: 'id',
      presence: 'required',
      sourcePath: 'id',
      applyFeedPrefix: true,
    },
    active_period: { kind: 'json', sourcePath: 'alert.activePeriod' },
    cause: { kind: 'text', sourcePath: 'alert.cause' },
    effect: { kind: 'text', sourcePath: 'alert.effect' },
    url: {
      kind: 'text',
      defaultValue: '',
      sourcePath: 'alert.url.translation[0].text',
    },
    start_time: {
      kind: 'text',
      sourcePath: 'alert.activePeriod[0].start',
    },
    end_time: {
      kind: 'text',
      sourcePath: 'alert.activePeriod[0].end',
    },
    header_text: {
      kind: 'text',
      presence: 'required',
      defaultValue: '',
      sourcePath: 'alert.headerText.translation[0].text',
    },
    description_text: {
      kind: 'text',
      presence: 'required',
      defaultValue: '',
      sourcePath: 'alert.descriptionText.translation[0].text',
    },
    tts_header_text: {
      kind: 'text',
      sourcePath: 'alert.ttsHeaderText.translation[0].text',
    },
    tts_description_text: {
      kind: 'text',
      sourcePath: 'alert.ttsDescriptionText.translation[0].text',
    },
    severity_level: { kind: 'text', sourcePath: 'alert.severityLevel' },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  storage: {
    indexes: ['id'],
  },
  namespace: 'gtfs-realtime',
});
