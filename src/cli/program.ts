import { Command } from "commander";
import { readFileSync } from "node:fs";
import { CliError } from "./errors.ts";
import { registerInfo } from "./commands/info.ts";
import { registerMonitors } from "./commands/monitors.ts";
import { registerNotifications } from "./commands/notifications.ts";
import { registerStatusPages } from "./commands/status-pages.ts";
import { registerMaintenance } from "./commands/maintenance.ts";
import { registerTags } from "./commands/tags.ts";
import { registerConfig } from "./commands/config.ts";

export function buildProgram(): Command {
  const pkg = readPkg();
  const program = new Command();

  program.name("kuma");
  program.description("CLI for Uptime Kuma monitoring");
  program.version(pkg.version ?? "0.0.0");

  program
    .option("--json", "machine-readable JSON output")
    .option("--plain", "stable line-based output (ids/names only)")
    .option("-q, --quiet", "suppress logs")
    .option("-v, --verbose", "verbose diagnostics to stderr")
    .option("--no-color", "disable colored output")
    .option("--url <url>", "Kuma server URL (overrides config)")
    .option("--timeout <ms>", "socket timeout in ms (default: 30000)", (v) => parseInt(v, 10));

  program.hook("preAction", (cmd) => {
    const o = cmd.optsWithGlobals();
    if (o.json && o.plain) throw new CliError("Use only one of --json or --plain", { exitCode: 2 });
  });

  registerInfo(program);
  registerMonitors(program);
  registerNotifications(program);
  registerStatusPages(program);
  registerMaintenance(program);
  registerTags(program);
  registerConfig(program);

  return program;
}

function readPkg(): { version?: string } {
  try {
    const url = new URL("../../package.json", import.meta.url);
    const txt = readFileSync(url, "utf8");
    return JSON.parse(txt) as { version?: string };
  } catch {
    return {};
  }
}
