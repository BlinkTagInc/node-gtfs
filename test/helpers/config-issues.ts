import assert from 'node:assert/strict';
import type { GtfsConfigIssue } from '../../src/index.ts';

/** Compare machine-readable diagnostics without fixing their explanatory prose. */
export function configIssueDetails(issues: readonly GtfsConfigIssue[]) {
  return issues.map(({ message, ...details }) => {
    assert.ok(message.length > 0, 'Configuration issues must remain readable');
    return details;
  });
}
