import { createGtfsConfigError } from '../diagnostics/errors.ts';
import { parseFlags } from './options.ts';
import type { CommandSummary, Flag, FlagValues } from './options.ts';

export type CliCommand = CommandSummary &
  (
    | { readonly commands: readonly CliCommand[] }
    | {
        readonly flags: readonly Flag[];
        readonly run: (values: FlagValues) => Promise<void>;
      }
  );

function listCommands(commands: readonly CliCommand[]): CommandSummary[] {
  return commands.flatMap((command) => {
    if ('commands' in command) {
      return listCommands(command.commands).map(({ name, summary }) => ({
        name: `${command.name} ${name}`,
        summary,
      }));
    }
    return [{ name: command.name, summary: command.summary }];
  });
}

export async function runCliCommand({
  command,
  args,
  parentCommand,
}: {
  readonly command: CliCommand;
  readonly args: readonly string[];
  readonly parentCommand?: string;
}): Promise<void> {
  const commandName =
    parentCommand === undefined
      ? command.name
      : `${parentCommand} ${command.name}`;

  if ('commands' in command) {
    const [name, ...remainingArgs] = args;
    if (name !== undefined && !name.startsWith('-')) {
      const subcommand = command.commands.find((entry) => entry.name === name);
      if (subcommand === undefined) {
        throw createGtfsConfigError(
          `Unknown command ${JSON.stringify(name)}; run \`${commandName} --help\` to see available commands`,
          { command: commandName, unknownCommand: name },
        );
      }
      await runCliCommand({
        command: subcommand,
        args: remainingArgs,
        parentCommand: commandName,
      });
      return;
    }
    parseFlags({
      command: commandName,
      summary: command.summary,
      flags: [],
      args,
      commands: listCommands(command.commands),
    });
    return;
  }

  const values = parseFlags({
    command: commandName,
    summary: command.summary,
    flags: command.flags,
    args,
  });
  await command.run(values);
}
