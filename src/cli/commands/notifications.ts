import type { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

type NotifRecord = Record<string, unknown>;

export function registerNotifications(program: Command): void {
  const cmd = program.command("notifications").alias("notifs").description("Manage notifications");

  // --- list ---
  cmd
    .command("list")
    .alias("ls")
    .description("List all notifications")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const notifications = client.getNotifications() as NotifRecord[];

        writeOut(ctx, {
          human: formatNotifications(notifications),
          plain: notifications.map((n) => String(n.id)).join("\n"),
          json: { notifications },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- get ---
  cmd
    .command("get")
    .description("Get notification details (by ID or name substring)")
    .argument("<query>", "notification ID or name substring")
    .action(async (query: string, _options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const notifications = client.getNotifications() as NotifRecord[];
        const notif = resolveNotification(query, notifications);
        const full = parseConfig(notif);

        writeOut(ctx, {
          human: formatNotifDetail(full),
          plain: String(full.id),
          json: { notification: full },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- test ---
  cmd
    .command("test")
    .description("Fire a test notification")
    .argument("<query>", "notification ID or name substring")
    .action(async (query: string, _options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const notifications = client.getNotifications() as NotifRecord[];
        const notif = resolveNotification(query, notifications);
        const full = parseConfig(notif);

        await client.testNotification(full);

        writeOut(ctx, {
          human: `Test notification sent for "${full.name}" (id: ${full.id})`,
          plain: String(full.id),
          json: { ok: true, id: full.id },
        });
      } finally {
        client.disconnect();
      }
    });
}

/** Resolve query to a notification object — numeric matches id, otherwise substring on name. */
function resolveNotification(query: string, notifications: NotifRecord[]): NotifRecord {
  const n = parseInt(query, 10);
  if (Number.isFinite(n) && n >= 1) {
    const found = notifications.find((x) => x.id === n);
    if (!found) throw new CliError(`No notification with id ${n}`, { exitCode: 2 });
    return found;
  }

  const q = query.toLowerCase();
  const matches = notifications.filter((x) => String(x.name ?? "").toLowerCase().includes(q));

  if (matches.length === 0) throw new CliError(`No notification matching "${query}"`, { exitCode: 2 });
  if (matches.length > 1) {
    const names = matches.map((x) => `  ${String(x.id).padStart(4)}  ${x.name}`).join("\n");
    throw new CliError(`Ambiguous query "${query}" — matches ${matches.length} notifications:\n${names}`, { exitCode: 2 });
  }
  return matches[0]!;
}

/** Parse the JSON `config` field and merge into a flat object for display/API use. */
function parseConfig(notif: NotifRecord): NotifRecord {
  const result = { ...notif };
  if (typeof result.config === "string") {
    try {
      const parsed = JSON.parse(result.config) as Record<string, unknown>;
      Object.assign(result, parsed);
      delete result.config;
    } catch { /* keep raw config */ }
  }
  return result;
}

function formatNotifDetail(n: NotifRecord): string {
  const lines = [
    `ID:       ${n.id}`,
    `Name:     ${n.name}`,
    `Type:     ${n.type}`,
    `Active:   ${n.active ? "yes" : "no"}`,
    `Default:  ${n.isDefault ? "yes" : "no"}`,
  ];

  const skip = new Set(["id", "name", "type", "active", "isDefault", "userId"]);
  for (const [key, val] of Object.entries(n)) {
    if (skip.has(key) || val === null || val === undefined || val === "") continue;
    lines.push(`${key}: ${typeof val === "object" ? JSON.stringify(val) : val}`);
  }
  return lines.join("\n");
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
