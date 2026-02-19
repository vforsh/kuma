import type { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

type MonitorRecord = Record<string, unknown>;

const MONITOR_TYPES: Record<string, string> = {
  http: "http",
  port: "port",
  ping: "ping",
  keyword: "keyword",
  dns: "dns",
  push: "push",
  steam: "steam",
  mqtt: "mqtt",
  docker: "docker",
  grpc: "grpc-keyword",
  sqlserver: "sqlserver",
  postgres: "postgres",
  mysql: "mysql",
  mongodb: "mongodb",
  radius: "radius",
  redis: "redis",
  gamedig: "gamedig",
  group: "group",
  snmp: "snmp",
  json: "json-query",
  realBrowser: "real-browser",
  tailscalePing: "tailscale-ping",
  rabbitmq: "rabbitmq",
  kafka: "kafka-producer",
};

export function registerMonitors(program: Command): void {
  const cmd = program.command("monitors").alias("mon").description("Manage monitors");

  // --- list ---
  cmd
    .command("list")
    .description("List all monitors")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const monitors = client.getMonitors();

        writeOut(ctx, {
          human: formatTable(monitors),
          plain: monitors.map((m) => String(m.id)).join("\n"),
          json: { monitors },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- get ---
  cmd
    .command("get")
    .description("Get monitor details (by ID or name substring)")
    .argument("<query>", "monitor ID or name substring")
    .action(async (query: string, _options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const id = resolveMonitor(query, client.getMonitors());
        const monitor = await client.getMonitor(id);
        writeOut(ctx, {
          human: formatMonitorDetail(monitor),
          plain: String(monitor.id),
          json: { monitor },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- add ---
  cmd
    .command("add")
    .description("Add a new monitor")
    .argument("<type>", `monitor type (${Object.keys(MONITOR_TYPES).join(", ")})`)
    .argument("<name>", "display name")
    .argument("[target]", "URL, hostname, or connection string")
    .option("--interval <seconds>", "check interval in seconds", (v) => parseInt(v, 10))
    .option("--retries <n>", "max retries before down", (v) => parseInt(v, 10))
    .option("--retry-interval <seconds>", "retry interval", (v) => parseInt(v, 10))
    .option("--keyword <text>", "keyword to search for (keyword type)")
    .option("--port <n>", "port number (port type)", (v) => parseInt(v, 10))
    .option("--upside-down", "upside down mode")
    .action(async (type: string, name: string, target: string | undefined, options: any, sub: Command) => {
      const ctx = await ctxFromCommand(sub);

      const kumaType = MONITOR_TYPES[type];
      if (!kumaType) throw new CliError(`Unknown monitor type: ${type}. Valid: ${Object.keys(MONITOR_TYPES).join(", ")}`, { exitCode: 2 });

      const data: Record<string, unknown> = {
        type: kumaType,
        name,
        active: true,
        interval: 60,
        retryInterval: 60,
        maxretries: 0,
        notificationIDList: {},
        accepted_statuscodes: ["200-299"],
        method: "GET",
        conditions: [],
        kafkaProducerBrokers: [],
        kafkaProducerSaslOptions: { mechanism: "None" },
        rabbitmqNodes: [],
      };

      // Set target based on type
      if (kumaType === "http" || kumaType === "keyword" || kumaType === "json-query" || kumaType === "real-browser") {
        if (!target) throw new CliError("URL is required for this monitor type", { exitCode: 2 });
        data.url = target;
      } else if (kumaType === "port") {
        if (!target) throw new CliError("Hostname is required for port monitors", { exitCode: 2 });
        data.hostname = target;
        if (options.port) data.port = options.port;
      } else if (kumaType === "ping" || kumaType === "tailscale-ping") {
        if (!target) throw new CliError("Hostname is required for ping monitors", { exitCode: 2 });
        data.hostname = target;
      } else if (kumaType === "dns") {
        if (!target) throw new CliError("Hostname is required for DNS monitors", { exitCode: 2 });
        data.hostname = target;
      } else if (kumaType === "push") {
        // Push monitors don't need a target — server generates push URL
      } else if (kumaType === "group") {
        // Group monitors don't need a target
      } else if (target) {
        // Generic: try hostname for other types
        data.hostname = target;
      }

      if (options.interval) data.interval = options.interval;
      if (options.retries) data.maxretries = options.retries;
      if (options.retryInterval) data.retryInterval = options.retryInterval;
      if (options.keyword) data.keyword = options.keyword;
      if (options.upsideDown) data.upsideDown = true;

      const client = await makeClient(ctx);
      try {
        const result = await client.addMonitor(data);
        ctx.log.info(`Monitor added (id: ${result.monitorID})`);

        writeOut(ctx, {
          human: `Monitor ${result.monitorID} created`,
          plain: String(result.monitorID),
          json: { monitorID: result.monitorID },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- pause ---
  cmd
    .command("pause")
    .description("Pause a monitor")
    .argument("<query>", "monitor ID or name substring")
    .action(async (query: string, _options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const id = resolveMonitor(query, client.getMonitors());
        await client.pauseMonitor(id);
        ctx.log.info(`Monitor ${id} paused`);
        writeOut(ctx, {
          human: `Paused monitor ${id}`,
          plain: String(id),
          json: { ok: true, monitorID: id },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- resume ---
  cmd
    .command("resume")
    .description("Resume a monitor")
    .argument("<query>", "monitor ID or name substring")
    .action(async (query: string, _options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const id = resolveMonitor(query, client.getMonitors());
        await client.resumeMonitor(id);
        ctx.log.info(`Monitor ${id} resumed`);
        writeOut(ctx, {
          human: `Resumed monitor ${id}`,
          plain: String(id),
          json: { ok: true, monitorID: id },
        });
      } finally {
        client.disconnect();
      }
    });

  // --- delete ---
  cmd
    .command("delete")
    .description("Delete a monitor")
    .argument("<query>", "monitor ID or name substring")
    .action(async (query: string, _options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const id = resolveMonitor(query, client.getMonitors());
        await client.deleteMonitor(id);
        ctx.log.info(`Monitor ${id} deleted`);
        writeOut(ctx, {
          human: `Deleted monitor ${id}`,
          plain: String(id),
          json: { ok: true, monitorID: id },
        });
      } finally {
        client.disconnect();
      }
    });
}

function parseId(s: string): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) throw new CliError(`Invalid monitor ID: ${s}`, { exitCode: 2 });
  return n;
}

/** Resolve a query to a monitor ID — numeric ID passes through, otherwise substring match on name. */
function resolveMonitor(query: string, monitors: MonitorRecord[]): number {
  const n = parseInt(query, 10);
  if (Number.isFinite(n) && n >= 1) return n;

  const q = query.toLowerCase();
  const matches = monitors.filter((m) => String(m.name ?? "").toLowerCase().includes(q));

  if (matches.length === 0) throw new CliError(`No monitor matching "${query}"`, { exitCode: 2 });
  if (matches.length > 1) {
    const names = matches.map((m) => `  ${String(m.id).padStart(4)}  ${m.name}`).join("\n");
    throw new CliError(`Ambiguous query "${query}" — matches ${matches.length} monitors:\n${names}`, { exitCode: 2 });
  }
  return matches[0]!.id as number;
}

function formatTable(monitors: MonitorRecord[]): string {
  if (monitors.length === 0) return "No monitors found";

  const rows = monitors.map((m) => {
    const id = String(m.id ?? "?");
    const name = String(m.name ?? "");
    const type = String(m.type ?? "");
    const active = m.active ? "up" : "paused";
    const url = String(m.url ?? m.hostname ?? "");
    return `${id.padStart(4)}  ${active.padEnd(7)} ${type.padEnd(12)} ${name.padEnd(30)} ${url}`;
  });

  const header = `${"ID".padStart(4)}  ${"STATUS".padEnd(7)} ${"TYPE".padEnd(12)} ${"NAME".padEnd(30)} TARGET`;
  return [header, ...rows].join("\n");
}

function formatMonitorDetail(m: MonitorRecord): string {
  const lines = [
    `ID:       ${m.id}`,
    `Name:     ${m.name}`,
    `Type:     ${m.type}`,
    `Active:   ${m.active}`,
  ];
  if (m.url) lines.push(`URL:      ${m.url}`);
  if (m.hostname) lines.push(`Host:     ${m.hostname}`);
  if (m.port) lines.push(`Port:     ${m.port}`);
  if (m.interval) lines.push(`Interval: ${m.interval}s`);
  if (m.keyword) lines.push(`Keyword:  ${m.keyword}`);
  return lines.join("\n");
}
