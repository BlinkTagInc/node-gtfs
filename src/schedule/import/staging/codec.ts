import { deserialize, serialize } from 'node:v8';
import type {
  NormalizedImportRow,
  NormalizedGtfsValue,
} from '../../../values/normalize-row.ts';
import type { GtfsSourcePosition } from '../../../diagnostics/position.ts';

export interface WorkingRecord<
  Row extends NormalizedImportRow,
  Position extends GtfsSourcePosition,
> {
  readonly row: Row;
  readonly position: Position;
}

interface EncodedWorkingBatch {
  // Repeated column values appear once; V8 retains exact BigInt values.
  readonly rowTemplate: NormalizedImportRow;
  readonly varyingFields: readonly string[];
  readonly varyingValues: readonly NormalizedGtfsValue[];
  readonly positionKind: GtfsSourcePosition['kind'];
  readonly encodedPositions: readonly number[];
}

function compactWorkingRows(
  rowFields: readonly string[],
  rowValues: readonly NormalizedGtfsValue[],
) {
  const varyingIndexes: number[] = [];
  const rowTemplate: NormalizedImportRow = Object.fromEntries(
    rowFields.map((field, index) => {
      const first = rowValues[index] as NormalizedGtfsValue;
      for (
        let offset = index + rowFields.length;
        offset < rowValues.length;
        offset += rowFields.length
      ) {
        // Signed zero must remain distinct even when every other value matches.
        if (!Object.is(rowValues[offset], first)) {
          varyingIndexes.push(index);
          return [field, null];
        }
      }
      return [field, first];
    }),
  );
  if (varyingIndexes.length === rowFields.length) {
    return { rowTemplate, varyingFields: rowFields, varyingValues: rowValues };
  }
  const varyingValues: NormalizedGtfsValue[] = [];
  for (let offset = 0; offset < rowValues.length; offset += rowFields.length) {
    for (const index of varyingIndexes) {
      varyingValues.push(rowValues[offset + index] as NormalizedGtfsValue);
    }
  }
  return {
    rowTemplate,
    varyingFields: varyingIndexes.map((index) => rowFields[index] as string),
    varyingValues,
  };
}

/** Estimate retained heap size, not the compressed payload size. */
export function estimateGtfsWorkingRecordBytes(
  rowValues: readonly NormalizedGtfsValue[],
): number {
  let bytes = 128;
  for (const value of rowValues) {
    bytes += 32;
    if (typeof value === 'string') {
      bytes += value.length * 2;
    }
  }
  return bytes;
}

export function appendGtfsWorkingPosition(
  encodedPositions: number[],
  position: GtfsSourcePosition,
): void {
  if (position.kind === 'csv') {
    encodedPositions.push(position.recordNumber, position.csvLineNumber);
  } else {
    encodedPositions.push(
      position.kind === 'geojson'
        ? position.featureNumber
        : position.entityNumber,
    );
  }
}

/** Rows must share field order and position kind; the batch manager enforces this. */
export function encodeGtfsWorkingBatch({
  rowFields,
  rowValues,
  positionKind,
  encodedPositions,
}: {
  readonly rowFields: readonly string[];
  readonly rowValues: readonly NormalizedGtfsValue[];
  readonly positionKind: GtfsSourcePosition['kind'];
  readonly encodedPositions: readonly number[];
}): Buffer {
  return serialize({
    ...compactWorkingRows(rowFields, rowValues),
    positionKind,
    encodedPositions,
  } satisfies EncodedWorkingBatch);
}

export function* decodeGtfsWorkingBatch<
  Row extends NormalizedImportRow = NormalizedImportRow,
  Position extends GtfsSourcePosition = GtfsSourcePosition,
>(payload: Buffer): Generator<WorkingRecord<Row, Position>> {
  const stored = deserialize(payload) as EncodedWorkingBatch;
  const positionWidth = stored.positionKind === 'csv' ? 2 : 1;
  // Cloning the complete shape avoids wide dictionary-mode rows and
  // keeps __proto__ an own data property, including when its value varies.
  let valueIndex = 0;
  for (
    let index = 0;
    index < stored.encodedPositions.length;
    index += positionWidth
  ) {
    const row: Record<string, NormalizedGtfsValue> = {
      ...stored.rowTemplate,
    };
    for (const field of stored.varyingFields) {
      row[field] = stored.varyingValues[valueIndex] as NormalizedGtfsValue;
      valueIndex += 1;
    }
    const number = stored.encodedPositions[index] as number;
    const position: GtfsSourcePosition =
      stored.positionKind === 'csv'
        ? {
            kind: 'csv',
            recordNumber: number,
            csvLineNumber: stored.encodedPositions[index + 1] as number,
          }
        : stored.positionKind === 'geojson'
          ? { kind: 'geojson', featureNumber: number }
          : { kind: 'realtime', entityNumber: number };
    yield { row: row as Row, position: position as Position };
  }
}
