import {
  applyCliConfigOverrides,
  type CliOperation,
} from './config-overrides.ts';
import { loadCliConfigFile } from './config-file.ts';

import type { FlagValues } from './options.ts';

export async function loadCliConfig<Config>(
  cliArguments: FlagValues,
  operation: CliOperation = 'import',
): Promise<Config> {
  const config = await loadCliConfigFile({ cliArguments });
  return applyCliConfigOverrides({
    config,
    cliArguments,
    operation,
  }) as Config;
}
