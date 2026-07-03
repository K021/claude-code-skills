#!/usr/bin/env python3
"""SessionStart hook — auto-recover project-context.

Reads the project's meta/structures/project-context.json (relative to the
session cwd) and injects its recovery essentials (summary + next_steps) into
the session via `additionalContext`, so a fresh/resumed/compacted session
restores "where we are · the next step" without being told to.

Silent no-op when the file is absent (projects that don't use the system) so
the hook is safe to leave enabled globally. Deterministic session-start
trigger — a CLAUDE.md instruction alone is a soft nudge, not a trigger.
"""
import json
import os
import sys


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    cwd = data.get("cwd") or os.getcwd()
    path = os.path.join(cwd, "meta", "structures", "project-context.json")
    if not os.path.isfile(path):
        return  # not a project-context project — silent pass

    try:
        with open(path, encoding="utf-8") as f:
            ctx = json.load(f)
    except Exception:
        return  # unreadable/invalid — don't break session start

    summary = (ctx.get("summary") or "").strip()
    next_steps = [s for s in (ctx.get("next_steps") or []) if str(s).strip()]
    if not summary and not next_steps:
        return

    lines = [
        "[project-context] Recovering where this project left off "
        "(read before responding):"
    ]
    if summary:
        lines.append(f"- summary: {summary}")
    if next_steps:
        lines.append("- next_steps:")
        lines.extend(f"    {i+1}. {s}" for i, s in enumerate(next_steps[:5]))
    lines.append(
        f"- full index: {path} "
        "(code_map, key_decisions, recent_tasks, open_limitations…)"
    )

    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": "\n".join(lines),
        }
    }))


if __name__ == "__main__":
    main()
