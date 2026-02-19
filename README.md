# @vforsh/kuma

Bun CLI for Uptime Kuma monitoring.

## Install

```bash
bunx @vforsh/kuma --help
```

Or install globally:

```bash
bun install -g @vforsh/kuma
kuma --help
```

## Auth

Preferred — env vars:

```bash
export KUMA_URL="https://uptime.example.com"
export KUMA_USERNAME="admin"
export KUMA_PASSWORD="secret"
```

Or store locally:

```bash
kuma config set url https://uptime.example.com
kuma config set username admin
echo "$KUMA_PASSWORD" | kuma config set password
```

Precedence: env > config file.

## Examples

```bash
kuma info
kuma monitors list
kuma monitors get 1
kuma monitors add http "My Site" https://example.com --interval 60
kuma monitors pause 1
kuma monitors resume 1
kuma monitors delete 1
kuma notifications list
kuma status-pages list
kuma maintenance list
kuma tags list
```

## Output modes

- default: human-friendly tables
- `--plain`: stable line output (ids only)
- `--json`: stable JSON output

## Global flags

```
--json          machine-readable JSON output
--plain         stable line-based output (ids/names only)
-q, --quiet     suppress logs
-v, --verbose   verbose diagnostics to stderr
--no-color      disable colored output
--url <url>     Kuma server URL (overrides config)
--timeout <ms>  socket timeout in ms (default: 30000)
```

## Config

Stored at `~/.config/kuma/config.json` (XDG-compliant).

```bash
kuma config path           # print config file path
kuma config get            # show config (password redacted)
kuma config set <key> [value]  # set a key
kuma config unset <key>    # remove a key
```

Valid keys: `url`, `username`, `password`.

Password is never accepted via argv — always use stdin or `--from-env`.
