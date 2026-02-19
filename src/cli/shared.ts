import { CliError } from "./errors.ts";
import { createCtx, type Ctx, type GlobalOptions } from "./context.ts";
import { KumaClient } from "../api/client.ts";

export async function ctxFromCommand(cmd: any): Promise<Ctx> {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  return await createCtx(opts);
}

export function requireUrl(ctx: Ctx): string {
  if (!ctx.url) throw new CliError("Missing server URL. Set KUMA_URL or run: kuma config set url <url>", { exitCode: 3 });
  return ctx.url;
}

export function requireAuth(ctx: Ctx): { url: string; username: string; password: string } {
  const url = requireUrl(ctx);
  if (!ctx.username) throw new CliError("Missing username. Set KUMA_USERNAME or run: kuma config set username <name>", { exitCode: 3 });
  if (!ctx.password) throw new CliError("Missing password. Set KUMA_PASSWORD or run: echo $KUMA_PASSWORD | kuma config set password", { exitCode: 3 });
  return { url, username: ctx.username, password: ctx.password };
}

export async function makeClient(ctx: Ctx): Promise<KumaClient> {
  const { url, username, password } = requireAuth(ctx);
  const client = new KumaClient({ timeoutMs: ctx.timeoutMs, log: ctx.log });
  await client.connect(url);
  await client.login(username, password);
  return client;
}
