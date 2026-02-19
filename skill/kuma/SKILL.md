# kuma — Uptime Kuma CLI

CLI for managing Uptime Kuma monitors, notifications, status pages, maintenance, and tags.

- **Instance:** `https://uptime.rwhl.se`
- **Credentials:** Bitwarden → "Uptime Kuma" (username: `vforsh`)

## Quick Start

```bash
# Auth (env vars or config)
export KUMA_URL="https://uptime.rwhl.se"
export KUMA_USERNAME="vforsh"
export KUMA_PASSWORD="secret"

# Or persist (password from Bitwarden)
kuma cfg set url https://uptime.rwhl.se
kuma cfg set username vforsh
bw-get.sh password "Uptime Kuma" | kuma cfg set password
```

## Commands

Aliases: `i` → info, `notifs` → notifications, `cfg` → config.

### Info

```bash
kuma i                       # server version
kuma i --json                # full info JSON
```

### Monitors

```bash
kuma monitors list           # table: id, status, type, name, target
kuma monitors list --json    # full JSON array
kuma monitors list --plain   # one id per line
kuma monitors get <id>       # single monitor detail
kuma monitors add <type> <name> [target]  # create monitor
kuma monitors pause <id>
kuma monitors resume <id>
kuma monitors delete <id>
```

**Monitor types:** http, port, ping, keyword, dns, push, steam, mqtt, docker, grpc, sqlserver, postgres, mysql, mongodb, radius, redis, gamedig, group, snmp, json, realBrowser, tailscalePing, rabbitmq, kafka.

**Add options:**
- `--interval <seconds>` — check interval (default: 60)
- `--retries <n>` — max retries before marking down (default: 0)
- `--retry-interval <seconds>` — time between retries (default: 60)
- `--keyword <text>` — keyword to search (keyword type)
- `--port <n>` — port number (port type)
- `--upside-down` — invert status logic

**Examples:**
```bash
kuma monitors add http "My Site" https://example.com
kuma monitors add http "API Health" https://api.example.com/health --interval 30
kuma monitors add ping "Server" 192.168.1.1
kuma monitors add port "SSH" myhost.com --port 22
kuma monitors add keyword "Status" https://example.com/status --keyword "operational"
```

### Notifications

```bash
kuma notifs list             # all notification channels
kuma notifs list --json
```

### Status Pages

```bash
kuma status-pages list
kuma status-pages list --json
```

### Maintenance

```bash
kuma maintenance list
kuma maintenance list --json
```

### Tags

```bash
kuma tags list
kuma tags list --json
```

### Config

```bash
kuma cfg path                # config file location
kuma cfg get                 # show config (password redacted)
kuma cfg set url <url>
kuma cfg set username <name>
echo $KUMA_PASSWORD | kuma cfg set password
kuma cfg set password --from-env
kuma cfg unset <key>         # keys: url, username, password
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable JSON to stdout |
| `--plain` | One id per line to stdout |
| `-q, --quiet` | Suppress stderr logs |
| `-v, --verbose` | Verbose diagnostics to stderr |
| `--no-color` | Disable terminal colors |
| `--url <url>` | Override server URL |
| `--timeout <ms>` | Socket timeout (default: 30000) |

## Output Contract

- **stdout**: data only (tables, JSON, ids)
- **stderr**: logs, progress, diagnostics
- `--json`: `{ monitors: [...] }` or `{ error: { message, exitCode } }`
- `--plain`: one id per line

## Auth

`KUMA_URL` / `KUMA_USERNAME` / `KUMA_PASSWORD` env vars override config file values.

Password is never accepted via CLI argument — use stdin pipe or `--from-env`.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Generic error |
| 2 | Validation / bad args |
| 3 | Auth failure |
| 7 | Server / socket error |
