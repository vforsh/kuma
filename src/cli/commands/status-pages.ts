import type { Command } from "commander";
import { ctxFromCommand, makeClient } from "../shared.ts";
import { writeOut } from "../output.ts";

export function registerStatusPages(program: Command): void {
  const cmd = program.command("status-pages").description("Manage status pages");

  cmd
    .command("list")
    .description("List all status pages")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const client = await makeClient(ctx);
      try {
        const pages = client.getStatusPages();

        writeOut(ctx, {
          human: formatStatusPages(pages),
          plain: pages.map((p) => String(p.slug ?? p.id)).join("\n"),
          json: { statusPages: pages },
        });
      } finally {
        client.disconnect();
      }
    });
}

function formatStatusPages(pages: Record<string, unknown>[]): string {
  if (pages.length === 0) return "No status pages found";

  const rows = pages.map((p) => {
    const id = String(p.id ?? "?");
    const slug = String(p.slug ?? "");
    const title = String(p.title ?? "");
    return `${id.padStart(4)}  ${slug.padEnd(24)} ${title}`;
  });

  const header = `${"ID".padStart(4)}  ${"SLUG".padEnd(24)} TITLE`;
  return [header, ...rows].join("\n");
}
