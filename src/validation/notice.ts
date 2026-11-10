import type { GtfsValidationNotice } from '../diagnostics/errors.ts';
import type { ValidateGtfsSourceOptions } from './types.ts';

export function createValidationNotice(
  options: ValidateGtfsSourceOptions,
  data: Omit<GtfsValidationNotice, 'sourceId'>,
): GtfsValidationNotice {
  return {
    ...data,
    ...(options.sourceId === undefined ? {} : { sourceId: options.sourceId }),
  };
}
