import assert from 'node:assert/strict';

import type { NormalizedImportRowBatch } from '../../src/schedule/import/records.ts';
import { stageGtfsSource } from '../../src/schedule/import/process-source.ts';

export async function collectStagedImportBatches({
  batchSize,
  ...options
}: Parameters<typeof stageGtfsSource>[0] & {
  readonly batchSize: number;
}): Promise<NormalizedImportRowBatch[]> {
  const staged = await stageGtfsSource(options);
  try {
    staged.assertNormalized();
    assert.equal(staged.validation.shouldReject, false);
    return options.tables.flatMap((table) => {
      const file = staged.files.get(table.filename);
      assert.ok(file, `Expected staged file ${table.filename}`);
      return [...staged.batches(table, batchSize, file.totalRecordCount)];
    });
  } finally {
    await staged.close();
  }
}
