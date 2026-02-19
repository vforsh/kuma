import type { Ctx } from "./context.ts";

export function writeOut(ctx: Ctx, payload: { human?: string; plain?: string; json?: unknown }): void {
  if (ctx.mode === "json") {
    process.stdout.write(`${JSON.stringify(payload.json ?? {}, null, 2)}\n`);
    return;
  }
  if (ctx.mode === "plain") {
    if (payload.plain != null) process.stdout.write(`${payload.plain}\n`);
    return;
  }
  if (payload.human != null) process.stdout.write(`${payload.human}\n`);
}
