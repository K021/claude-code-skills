#!/usr/bin/env python3
"""Preemptive project-context update as the context window fills.

Hooks do not receive context-window usage directly, so the statusline sensor
(`statusline/ctx-sensor.sh`) writes the accurate `context_window.used_percentage`
Claude Code computes into a per-session state file. This hook (wired to Stop and
PostToolBatch) reads that value and, when usage crosses a threshold in a project
that uses project-context, injects an instruction so the model refreshes
`meta/structures/project-context.json` BEFORE auto-compaction discards the live
context. A marker makes it fire once per climb to the threshold (hysteresis).

Env:
  CTXGUARD_THRESHOLD  fire at/above this used-% (default 75)
  CTXGUARD_PCT        test override: use this % instead of the state file
"""
import json
import os
import sys

THRESHOLD = float(os.environ.get("CTXGUARD_THRESHOLD", "75"))
RESET = THRESHOLD - 15  # re-arm once usage drops this far below (e.g. after compaction)
STATE_DIR = os.path.expanduser("~/.claude/ctx-state")


def read_pct(session_id):
    override = os.environ.get("CTXGUARD_PCT")
    if override not in (None, ""):
        try:
            return float(override)
        except ValueError:
            return None
    try:
        with open(os.path.join(STATE_DIR, session_id)) as f:
            return float(f.read().strip())
    except Exception:
        return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    session_id = data.get("session_id") or "default"
    event = data.get("hook_event_name") or "Stop"
    cwd = data.get("cwd") or os.getcwd()

    # Only act in projects that actually use project-context.
    ctx_file = os.path.join(cwd, "meta", "structures", "project-context.json")
    if not os.path.isfile(ctx_file):
        return

    pct = read_pct(session_id)
    if pct is None:
        return

    os.makedirs(STATE_DIR, exist_ok=True)
    marker = os.path.join(STATE_DIR, session_id + ".nudged")

    # Hysteresis: usage dropped well below threshold (e.g. after a compaction) -> re-arm.
    if pct < RESET and os.path.exists(marker):
        try:
            os.remove(marker)
        except OSError:
            pass

    if pct < THRESHOLD or os.path.exists(marker):
        return  # not near the limit yet, or already nudged this climb

    try:
        open(marker, "w").close()  # fire once per climb
    except OSError:
        pass

    msg = (
        f"[project-context] The context window is at ~{int(pct)}% and auto-compaction "
        "is approaching. Before continuing, update meta/structures/project-context.json "
        "now: refresh `summary` and `next_steps` from this session (plus any new "
        "decisions/limitations/recent tasks) so nothing is lost when the window compacts. "
        "Then continue."
    )

    if event == "Stop":
        # Force the turn to continue instead of ending, with the instruction.
        print(json.dumps({"decision": "block", "reason": msg}))
    else:
        print(json.dumps({
            "hookSpecificOutput": {"hookEventName": event, "additionalContext": msg}
        }))


if __name__ == "__main__":
    main()
