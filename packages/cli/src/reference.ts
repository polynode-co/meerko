import type { Command } from "commander";
import { program } from "./program.ts";

export interface CliCommand {
  /** Full invocation, e.g. "meerko tables create <name>". */
  usage: string;
  group: string;
  description: string;
  options: { flags: string; description: string; default?: unknown; required: boolean }[];
}

const options = (cmd: Command) =>
  cmd.options.map((o) => ({ flags: o.flags, description: o.description, default: o.defaultValue, required: o.mandatory }));

/** Every leaf command (the ones that run something), for the docs. */
export function describeCli() {
  const commands: CliCommand[] = [];
  const walk = (cmd: Command, path: string[]) => {
    for (const sub of cmd.commands) {
      const args = sub.registeredArguments.map((a) => (a.required ? `<${a.name()}${a.variadic ? "..." : ""}>` : `[${a.name()}]`));
      const here = [...path, sub.name()];
      if (sub.commands.length > 0) walk(sub, here);
      else commands.push({ usage: [program.name(), ...here, ...args].join(" "), group: here[0]!, description: sub.description(), options: options(sub) });
    }
  };
  walk(program, []);
  return { globalOptions: options(program), groups: Object.fromEntries(program.commands.map((c) => [c.name(), c.description()])), commands };
}
