## General Rules

- **Runtime**: Bun only — no Node, no build step. TypeScript runs directly via `#!/usr/bin/env bun`.
- **File size**: Keep under ~500 LOC. Split before adding more logic.
- **Deps**: `commander` (CLI), `picocolors` (color), `zod` (validation). No `socket.io-client` — custom minimal impl in `src/api/socket.ts`.
- **Output contract**: Every command must produce three modes via `writeOut()` — `human` (tables/labels), `plain` (ids/names only), `json` (structured). Never mix stdout and stderr; logs go to stderr via `ctx.log`.
- **Errors**: Throw `CliError` with meaningful `exitCode`. Don't catch-and-log — top-level handler in `src/index.ts` does that.
- **Password handling**: Never accept passwords via argv. Always stdin or `--from-env`.

---

## Build / Test

- **Typecheck**: `bun run typecheck`
- **Run locally**: `bun run kuma` or `./bin/kuma`
- **No tests yet** — verify manually against a running Uptime Kuma instance.

---

## Publish

- **Package**: `@vforsh/kuma` on npm (scoped, public access)
- **Bump + publish**: update `version` in `package.json`, then `npm publish --access public`
- **Verify**: `bunx @vforsh/kuma --version`

---

## Repo Tour

```
bin/kuma                    Entry point (shebang → bun)
src/index.ts                main() — parse argv, top-level error handler
src/cli/program.ts          Commander setup, global flags, command registration
src/cli/context.ts          Ctx type — output mode, auth, logger
src/cli/shared.ts           ctxFromCommand(), makeClient() — auth helpers
src/cli/output.ts           writeOut() — tri-mode output
src/cli/errors.ts           CliError class
src/cli/commands/*.ts       One file per command group (monitors, tags, etc.)
src/api/client.ts           KumaClient — wraps Socket.IO calls
src/api/socket.ts           SioSocket — minimal Socket.IO v4 over native WebSocket
src/config/config.ts        XDG config at ~/.config/kuma/config.json
```

---

## Adding a New Command

1. Create `src/cli/commands/<name>.ts`
2. Export `registerXxx(program: Command)` — add subcommand to `program`
3. Wire it in `src/cli/program.ts` via `registerXxx(program)`
4. Use `ctxFromCommand(sub)` → `makeClient(ctx)` pattern
5. Always call `client.disconnect()` in `finally`
6. Always provide all three output modes to `writeOut()`

---

## Contracts

- **Exit codes**: `0` = success, `1` = general error, `2` = usage/validation, `3` = auth, `7` = connection/API
- **Config precedence**: env vars (`KUMA_URL`, `KUMA_USERNAME`, `KUMA_PASSWORD`) > `--url` flag > config file
- **Socket protocol**: Engine.IO 4 + Socket.IO v4 wire protocol. Custom impl — do not add `socket.io-client` dep.
- **Monitor resolution**: Commands accepting `<query>` try numeric ID first, then case-insensitive substring match on name. Ambiguous matches → error listing all matches.
