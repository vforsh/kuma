import type { Command } from "commander";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

export function registerMaintenance(program: Command): void {
  const cmd = program.command("maintenance").description("Manage maintenance windows");

  cmd
    .command("list")
    .alias("ls")
    .description("List all maintenance windows")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const items = client.getMaintenanceList();

        writeOut(ctx, {
          human: formatMaintenance(items),
          plain: items.map((m) => String(m.id)).join("\n"),
          json: { maintenance: items },
        });
      } finally {
        client.disconnect();
      }
    });
}

function formatMaintenance(items: Record<string, unknown>[]): string {
  if (items.length === 0) return "No maintenance windows found";

  const rows = items.map((m) => {
    const id = String(m.id ?? "?");
    const title = String(m.title ?? "");
    const active = m.active ? "active" : "inactive";
    const strategy = String(m.strategy ?? "");
    return `${id.padStart(4)}  ${active.padEnd(9)} ${strategy.padEnd(14)} ${title}`;
  });

  const header = `${"ID".padStart(4)}  ${"STATUS".padEnd(9)} ${"STRATEGY".padEnd(14)} TITLE`;
  return [header, ...rows].join("\n");
}
