#!/usr/bin/env node
// SessionStart hook — point the agent at the project's file map.
//
// Reads meta/structures/project-structure.json (relative to the session cwd)
// and injects a lightweight pointer (file/dir counts + path) via
// `additionalContext`, so a fresh/resumed/compacted session recovers the map
// in one read instead of re-discovering the codebase by grep. We inject a
// pointer, not the whole map, to keep session start fast and cheap.
//
// Silent no-op when the file is absent, so it is safe to leave enabled
// globally. A deterministic session-start trigger — not a CLAUDE.md nudge.
import fs from "node:fs";
import path from "node:path";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input);
  } catch {}

  const cwd = data.cwd || process.cwd();
  const p = path.join(cwd, "meta", "structures", "project-structure.json");
  if (!fs.existsSync(p)) return; // not a project-structure project — silent pass

  let snap;
  try {
    snap = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return; // unreadable/invalid — don't break session start
  }

  const files = Array.isArray(snap.files) ? snap.files : [];
  if (files.length === 0) return;
  const dirs =
    snap.directories && typeof snap.directories === "object"
      ? Object.keys(snap.directories).length
      : 0;

  const context =
    `[project-structure] A file map for this project exists: ${files.length} files` +
    `${dirs ? `, ${dirs} directories` : ""}. ` +
    `Read ${p} for what each file is and does, instead of grepping to ` +
    `re-discover the codebase.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    })
  );
});
