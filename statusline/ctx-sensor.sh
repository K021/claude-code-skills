#!/usr/bin/env bash
# Claude Code statusline that ALSO records context-window usage for hooks.
#
# Claude Code passes the accurate, pre-computed `context_window.used_percentage`
# to the statusline (but NOT to hooks). This script records it to a per-session
# state file so the project-context ctx-guard hook can read it and refresh the
# context index before auto-compaction. It then renders a status line.
#
# Setup (settings.json):
#   { "statusLine": { "type": "command", "command": "bash ~/.claude/ctx-sensor.sh" } }
#
# To keep your existing status line, set CTX_SENSOR_INNER to your current render
# command (it receives the same JSON on stdin), e.g. in settings.json env or a
# wrapper: CTX_SENSOR_INNER="sh ~/.claude/statusline-command.sh"
#
# Requires: jq.
set -u

input="$(cat)"

dir="$HOME/.claude/ctx-state"
mkdir -p "$dir"

sid="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
pct="$(printf '%s' "$input" | jq -r '.context_window.used_percentage // empty' 2>/dev/null)"
if [ -n "$sid" ] && [ -n "$pct" ]; then
  printf '%s' "$pct" > "$dir/$sid"
fi

# Render: chain to an existing status line if provided, else a sensible default.
if [ -n "${CTX_SENSOR_INNER:-}" ]; then
  printf '%s' "$input" | $CTX_SENSOR_INNER
else
  model="$(printf '%s' "$input" | jq -r '.model.display_name // "claude"' 2>/dev/null)"
  cwd="$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // ""' 2>/dev/null)"
  printf '[%s] %s | %s%% ctx' "$model" "$(basename "${cwd:-.}")" "${pct:-?}"
fi
