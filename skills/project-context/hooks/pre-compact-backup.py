#!/usr/bin/env python3
"""PreCompact safety net.

Before context compaction, copy the project's project-context.json to a
timestamped backup so a mechanical snapshot survives even if the model did not
refresh it in time. Does NOT block compaction — the meaningful refresh is driven
preemptively by ctx-guard (via the statusline sensor); this is the last-resort
snapshot. Silent no-op when the file is absent. Keeps the most recent 10 backups.
"""
import json
import os
import shutil
import sys
import time


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}

    cwd = data.get("cwd") or os.getcwd()
    src = os.path.join(cwd, "meta", "structures", "project-context.json")
    if not os.path.isfile(src):
        return

    backup_dir = os.path.join(cwd, "meta", "structures", ".pre-compact-backups")
    try:
        os.makedirs(backup_dir, exist_ok=True)
        dst = os.path.join(backup_dir, "project-context-" + time.strftime("%Y%m%d-%H%M%S") + ".json")
        shutil.copy2(src, dst)
    except Exception:
        return  # never break compaction

    # Retain only the 10 most recent backups.
    try:
        backups = sorted(f for f in os.listdir(backup_dir) if f.endswith(".json"))
        for old in backups[:-10]:
            os.remove(os.path.join(backup_dir, old))
    except Exception:
        pass


if __name__ == "__main__":
    main()
