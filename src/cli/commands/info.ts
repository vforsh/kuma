import type { Command } from "commander";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

export function registerInfo(program: Command): void {
  program
    .command("info")
    .alias("i")
    .description("Show server info (version, uptime, etc.)")
    .action(async (_options: unknown, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const client = await makeClient(ctx);
      try {
        const info = client.getInfo();
        const version = String(info.version ?? "unknown");
        const tz = info.serverTimezone ? `${info.serverTimezone} (${info.serverTimezoneOffset ?? ""})` : null;
        const rt = info.runtime as { platform?: string; arch?: string } | undefined;
        const platform = rt ? `${rt.platform}/${rt.arch}${info.isContainer ? " (container)" : ""}` : null;
        const db = info.dbType ? String(info.dbType) : null;

        writeOut(ctx, {
          human: [
            `URL:       ${ctx.url}`,
            `Version:   ${version}`,
            tz ? `Timezone:  ${tz}` : null,
            platform ? `Platform:  ${platform}` : null,
            db ? `Database:  ${db}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          plain: version,
          json: { url: ctx.url, ...info },
        });
      } finally {
        client.disconnect();
      }
    });
}
