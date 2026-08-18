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
    communication_period: {
      kind: 'json',
      sourcePath: 'alert.communicationPeriod',
    },
    impact_period: { kind: 'json', sourcePath: 'alert.impactPeriod' },
    cause: {
      kind: 'enumeration',
      values: [
        'UNKNOWN_CAUSE',
        'OTHER_CAUSE',
        'TECHNICAL_PROBLEM',
        'STRIKE',
        'DEMONSTRATION',
        'ACCIDENT',
        'HOLIDAY',
        'WEATHER',
        'MAINTENANCE',
        'CONSTRUCTION',
        'POLICE_ACTIVITY',
        'MEDICAL_EMERGENCY',
        'SPECIAL_EVENT',
      ],
      sourcePath: 'alert.cause',
    },
    effect: {
      kind: 'enumeration',
      values: [
        'NO_SERVICE',
        'REDUCED_SERVICE',
        'SIGNIFICANT_DELAYS',
        'DETOUR',
        'ADDITIONAL_SERVICE',
        'MODIFIED_SERVICE',
        'OTHER_EFFECT',
        'UNKNOWN_EFFECT',
        'STOP_MOVED',
        'NO_EFFECT',
        'ACCESSIBILITY_ISSUE',
      ],
      sourcePath: 'alert.effect',
    },
    url: {
      kind: 'text',
      sourcePath: 'alert.url.translation[0].text',
    },
    url_translations: {
      kind: 'json',
      sourcePath: 'alert.url.translation',
    },
    start_time: {
      kind: 'integer',
      sourcePath: 'alert.activePeriod[0].start',
    },
    end_time: {
      kind: 'integer',
      sourcePath: 'alert.activePeriod[0].end',
    },
    header_text: {
      kind: 'text',
      presence: 'required',
      sourcePath: 'alert.headerText.translation[0].text',
    },
    header_text_translations: {
      kind: 'json',
      sourcePath: 'alert.headerText.translation',
    },
    description_text: {
      kind: 'text',
      presence: 'required',
      sourcePath: 'alert.descriptionText.translation[0].text',
    },
    description_text_translations: {
      kind: 'json',
      sourcePath: 'alert.descriptionText.translation',
    },
    tts_header_text: {
      kind: 'text',
      sourcePath: 'alert.ttsHeaderText.translation[0].text',
    },
    tts_header_text_translations: {
      kind: 'json',
      sourcePath: 'alert.ttsHeaderText.translation',
    },
    tts_description_text: {
      kind: 'text',
      sourcePath: 'alert.ttsDescriptionText.translation[0].text',
    },
    tts_description_text_translations: {
      kind: 'json',
      sourcePath: 'alert.ttsDescriptionText.translation',
    },
    severity_level: {
      kind: 'enumeration',
      values: ['UNKNOWN_SEVERITY', 'INFO', 'WARNING', 'SEVERE'],
      sourcePath: 'alert.severityLevel',
    },
    image: { kind: 'json', sourcePath: 'alert.image' },
    image_alternative_text: {
      kind: 'text',
      sourcePath: 'alert.imageAlternativeText.translation[0].text',
    },
    image_alternative_text_translations: {
      kind: 'json',
      sourcePath: 'alert.imageAlternativeText.translation',
    },
    cause_detail: {
      kind: 'text',
      sourcePath: 'alert.causeDetail.translation[0].text',
    },
    cause_detail_translations: {
      kind: 'json',
      sourcePath: 'alert.causeDetail.translation',
    },
    effect_detail: {
      kind: 'text',
      sourcePath: 'alert.effectDetail.translation[0].text',
    },
    effect_detail_translations: {
      kind: 'json',
      sourcePath: 'alert.effectDetail.translation',
    },
    created_timestamp: { kind: 'integer', presence: 'required' },
    expiration_timestamp: { kind: 'integer', presence: 'required' },
  },
  namespace: 'gtfs-realtime',
});
