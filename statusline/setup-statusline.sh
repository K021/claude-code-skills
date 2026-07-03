#!/usr/bin/env bash
# One-time setup for the "refresh before auto-compaction" feature.
#
# The ctx-guard hooks ship with the plugins and install automatically, but they
# need the context-usage % — which Claude Code exposes ONLY to the statusline,
# and a plugin cannot install a statusline. So this installs the statusline
# sensor for you: it writes ~/.claude/ctx-sensor.sh and wires it into your
# settings.json, PRESERVING any existing statusline (chained via CTX_SENSOR_INNER).
#
# Idempotent: safe to run multiple times / from both skills' init. Modifies
# settings.json (a backup is made). Requires jq (sensor) + python3 (merge).
set -eu

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SENSOR="$CLAUDE_DIR/ctx-sensor.sh"
SETTINGS="$CLAUDE_DIR/settings.json"
mkdir -p "$CLAUDE_DIR"

# 1) Write the canonical sensor.
cat > "$SENSOR" <<'SENSOR_EOF'
#!/usr/bin/env bash
# Statusline that also records context-window usage % for the ctx-guard hooks.
# Claude Code gives the exact context_window.used_percentage to the statusline
# (not to hooks), so we record it to a per-session state file the hooks read.
set -u
input="$(cat)"
dir="$HOME/.claude/ctx-state"; mkdir -p "$dir"
sid="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
pct="$(printf '%s' "$input" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)"
if [ -n "$sid" ] && [ -n "$pct" ]; then printf '%s' "$pct" > "$dir/$sid"; fi
# Render: chain an existing statusline if provided, else a sensible default.
if [ -n "${CTX_SENSOR_INNER:-}" ]; then
  printf '%s' "$input" | $CTX_SENSOR_INNER
else
  model="$(printf '%s' "$input" | jq -r '.model.display_name // "claude"' 2>/dev/null)"
  cwd="$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // ""' 2>/dev/null)"
  printf '[%s] %s | %s%% ctx' "$model" "$(basename "${cwd:-.}")" "${pct:-?}"
fi
SENSOR_EOF
chmod +x "$SENSOR"

# 2) Wire it into settings.json (idempotent, preserve existing statusline).
python3 - "$SETTINGS" "$SENSOR" <<'PY'
import json, os, shutil, sys, time
settings_path, sensor_path = sys.argv[1], sys.argv[2]
d = {}
if os.path.isfile(settings_path):
    try:
        d = json.load(open(settings_path))
    except Exception:
        print("WARN: settings.json is unreadable — not modifying it. "
              "Wire the sensor manually."); sys.exit(0)
sl = d.get("statusLine") if isinstance(d.get("statusLine"), dict) else {}
cmd = sl.get("command", "") if sl else ""
if "ctx-sensor.sh" in cmd:
    print("statusline sensor already wired; no change."); sys.exit(0)
if os.path.isfile(settings_path):
    shutil.copy2(settings_path, settings_path + ".bak-" + time.strftime("%Y%m%d-%H%M%S"))
inner = cmd
new_cmd = (f"CTX_SENSOR_INNER='{inner}' bash {sensor_path}") if inner else (f"bash {sensor_path}")
d["statusLine"] = {"type": "command", "command": new_cmd}
json.dump(d, open(settings_path, "w"), ensure_ascii=False, indent=2)
print("statusline sensor wired." + (f" (preserved existing: {inner})" if inner else ""))
PY

echo "OK: sensor at $SENSOR ; settings at $SETTINGS"
