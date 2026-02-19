import type { Command } from "commander";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

export function registerTags(program: Command): void {
  const cmd = program.command("tags").description("Manage tags");

  cmd
    .command("list")
    .alias("ls")
    .description("List all tags")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const tags = await client.getTags();

        writeOut(ctx, {
          human: formatTags(tags),
          plain: tags.map((t) => String(t.id)).join("\n"),
          json: { tags },
        });
      } finally {
        client.disconnect();
      }
    });
}

function formatTags(tags: Record<string, unknown>[]): string {
  if (tags.length === 0) return "No tags found";

  const rows = tags.map((t) => {
    const id = String(t.id ?? "?");
    const name = String(t.name ?? "");
    const color = String(t.color ?? "");
    return `${id.padStart(4)}  ${name.padEnd(20)} ${color}`;
  });

  const header = `${"ID".padStart(4)}  ${"NAME".padEnd(20)} COLOR`;
  return [header, ...rows].join("\n");
}
