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
        const version = info.version ?? "unknown";
        const latestVersion = info.latestVersion;

        writeOut(ctx, {
          human: [
            `Version:  ${version}`,
            latestVersion ? `Latest:   ${latestVersion}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          plain: String(version),
          json: { info },
        });
      } finally {
        client.disconnect();
      }
    });
}
