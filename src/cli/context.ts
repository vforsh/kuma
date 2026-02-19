import pc from "picocolors";
import { loadConfig, type KumaConfig } from "../config/config.ts";

export type OutputMode = "human" | "plain" | "json";

export type GlobalOptions = {
  json?: boolean;
  plain?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  url?: string;
  timeout?: number;
};

export type Ctx = {
  mode: OutputMode;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
  url?: string;
  username?: string;
  password?: string;
  timeoutMs: number;
  configPath: string;
  config: KumaConfig;
  log: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
};

export async function createCtx(opts: GlobalOptions): Promise<Ctx> {
  const { path: cfgPath, config } = await loadConfig();

  const mode: OutputMode = opts.json ? "json" : opts.plain ? "plain" : "human";
  const quiet = Boolean(opts.quiet);
  const verbose = Boolean(opts.verbose);
  const color = !opts.noColor && !process.env.NO_COLOR && Boolean(process.stderr.isTTY);

  const url = process.env.KUMA_URL ?? opts.url ?? config.url;
  const username = process.env.KUMA_USERNAME ?? config.username;
  const password = process.env.KUMA_PASSWORD ?? config.password;
  const timeoutMs = Number.isFinite(opts.timeout) ? Math.max(1, Number(opts.timeout)) : 30_000;

  const tagInfo = color ? pc.cyan("[kuma]") : "[kuma]";
  const tagWarn = color ? pc.yellow("[kuma]") : "[kuma]";
  const tagDbg = pc.dim("[kuma]");
  const log = {
    info: (...args: unknown[]) => {
      if (quiet) return;
      console.error(tagInfo, ...args);
    },
    warn: (...args: unknown[]) => {
      if (quiet) return;
      console.error(tagWarn, ...args);
    },
    debug: (...args: unknown[]) => {
      if (!verbose) return;
      console.error(tagDbg, ...args);
    },
  };

  return { mode, quiet, verbose, color, url, username, password, timeoutMs, configPath: cfgPath, config, log };
}
