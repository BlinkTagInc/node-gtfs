import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getEventLevel,
  type GtfsReportEvent,
  type GtfsReportEventInput,
} from '../../src/reporting/events.ts';
import { report } from '../../src/reporting/report.ts';

for (const level of ['info', 'warn', 'error'] as const) {
  for (const includeError of [false, true]) {
    test(`message level ${level} is respected ${includeError ? 'with' : 'without'} an error payload`, () => {
      const event: GtfsReportEventInput = {
        type: 'message',
        level,
        message: 'Example message',
        ...(includeError
          ? { error: { name: 'Error', message: 'Example error' } }
          : {}),
      };
      assert.equal(getEventLevel(event), level);

      for (const [threshold, acceptedLevels] of [
        ['silent', []],
        ['error', ['error']],
        ['warn', ['warn', 'error']],
        ['info', ['info', 'warn', 'error']],
      ] as const) {
        const events: GtfsReportEvent[] = [];
        report(
          { level: threshold, reporter: (delivered) => events.push(delivered) },
          event,
        );
        const accepted = acceptedLevels.some(
          (acceptedLevel) => acceptedLevel === level,
        );
        assert.deepEqual(
          events.map((delivered) => ({
            level: delivered.level,
            message: delivered.message,
            error: delivered.type === 'message' ? delivered.error : undefined,
          })),
          accepted
            ? [{ level, message: event.message, error: event.error }]
            : [],
          `Reporting threshold: ${threshold}`,
        );
      }
    });
  }
}
