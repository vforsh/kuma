import type { Command } from "commander";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

export function registerNotifications(program: Command): void {
  const cmd = program.command("notifications").alias("notifs").description("Manage notifications");

  cmd
    .command("list")
    .description("List all notifications")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const notifications = client.getNotifications() as Record<string, unknown>[];

        writeOut(ctx, {
          human: formatNotifications(notifications),
          plain: notifications.map((n) => String(n.id)).join("\n"),
          json: { notifications },
        });
      } finally {
        client.disconnect();
      }
    });
}

function formatNotifications(notifications: Record<string, unknown>[]): string {
  if (notifications.length === 0) return "No notifications found";

  const rows = notifications.map((n) => {
    const id = String(n.id ?? "?");
    const name = String(n.name ?? "");
    let type = String(n.type ?? "");
    if (!type && typeof n.config === "string") {
      try {
        type = String((JSON.parse(n.config) as Record<string, unknown>).type ?? "");
      } catch { /* ignore */ }
    }
    const active = n.active ? "on" : "off";
    const isDefault = n.isDefault ? " (default)" : "";
    return `${id.padStart(4)}  ${active.padEnd(4)} ${type.padEnd(16)} ${name}${isDefault}`;
  });

  const header = `${"ID".padStart(4)}  ${"ON".padEnd(4)} ${"TYPE".padEnd(16)} NAME`;
  return [header, ...rows].join("\n");
}
