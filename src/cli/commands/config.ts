import type { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand } from "../shared.ts";
import { configPath, loadConfig, saveConfig, type KumaConfig } from "../../config/config.ts";
import { readStdinText, stdinIsTty } from "../../util/stdin.ts";
import { redactPassword } from "../../util/redact.ts";

const VALID_KEYS = ["url", "username", "password"] as const;
type ConfigKey = (typeof VALID_KEYS)[number];

export function registerConfig(program: Command): void {
  const cmd = program.command("config").alias("cfg").description("Manage local configuration");

  // --- path ---
  cmd
    .command("path")
    .description("Print config file path")
    .action(async () => {
      process.stdout.write(`${configPath()}\n`);
    });

  // --- get ---
  cmd
    .command("get")
    .description("Print current config (password redacted)")
    .action(async (_options: unknown, sub: Command) => {
      const ctx = await ctxFromCommand(sub);
      const { config, path } = await loadConfig();
      const safe = toSafeConfig(config);
      if (ctx.mode === "json") {
        process.stdout.write(`${JSON.stringify({ path, config: safe }, null, 2)}\n`);
      } else {
        process.stdout.write(`${JSON.stringify({ path, config: safe }, null, 2)}\n`);
      }
    });

  // --- set ---
  cmd
    .command("set")
    .description("Set a config key")
    .argument("<key>", VALID_KEYS.join("|"))
    .argument("[value]", "value (avoid for password; use stdin)")
    .option("--from-env", "read from KUMA_PASSWORD env var (password only)")
    .action(async (key: string, value: string | undefined, options: any, parent: Command) => {
      await ctxFromCommand(parent);

      if (!VALID_KEYS.includes(key as ConfigKey)) {
        throw new CliError(`Unknown key: ${key}. Valid: ${VALID_KEYS.join(", ")}`, { exitCode: 2 });
      }

      const { config } = await loadConfig();
      const next: KumaConfig = { ...config };

      if (key === "password") {
        if (options.fromEnv) {
          const v = process.env.KUMA_PASSWORD;
          if (!v) throw new CliError("KUMA_PASSWORD is not set", { exitCode: 2 });
          next.password = v;
        } else {
          if (value != null) throw new CliError("Refusing to read password from argv. Use stdin: echo $KUMA_PASSWORD | kuma config set password", { exitCode: 2 });
          if (stdinIsTty()) throw new CliError("Password must be provided via stdin (pipe)", { exitCode: 2 });
          const v = (await readStdinText()).trim();
          if (!v) throw new CliError("stdin was empty", { exitCode: 2 });
          next.password = v;
        }
      } else if (key === "url") {
        if (!value) throw new CliError("value is required", { exitCode: 2 });
        next.url = value.replace(/\/+$/, "");
      } else if (key === "username") {
        if (!value) throw new CliError("value is required", { exitCode: 2 });
        next.username = value;
      }

      const { path } = await saveConfig(next);
      process.stdout.write(`${path}\n`);
    });

  // --- unset ---
  cmd
    .command("unset")
    .description("Unset a config key")
    .argument("<key>", VALID_KEYS.join("|"))
    .action(async (key: string, _options: unknown, parent: Command) => {
      await ctxFromCommand(parent);

      if (!VALID_KEYS.includes(key as ConfigKey)) {
        throw new CliError(`Unknown key: ${key}. Valid: ${VALID_KEYS.join(", ")}`, { exitCode: 2 });
      }

      const { config } = await loadConfig();
      const next: KumaConfig = { ...config };
      delete next[key as ConfigKey];
      const { path } = await saveConfig(next);
      process.stdout.write(`${path}\n`);
    });
}

function toSafeConfig(c: KumaConfig): Omit<KumaConfig, "password"> & { password: string | null } {
  const { password: _pw, ...rest } = c;
  return { ...rest, password: redactPassword(c.password) };
}
