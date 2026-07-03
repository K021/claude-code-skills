#!/usr/bin/env node
// Preemptive project-structure update as the context window fills.
//
// Hooks don't receive context-window usage, so the shared statusline sensor
// (statusline/ctx-sensor.sh) records the accurate `context_window.used_percentage`
// into a per-session state file. This hook (wired to Stop and PostToolBatch)
// reads it and, when usage crosses a threshold in a project that uses
// project-structure, forces a turn to refresh the file map BEFORE auto-compaction
// discards the live context. Fires once per climb (hysteresis via a marker).
//
// Uses a DISTINCT marker (.nudged-ps) so it never collides with project-context's
// ctx-guard when both skills are installed.
//
// Env: CTXGUARD_THRESHOLD (default 75), CTXGUARD_PCT (test override).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const THRESHOLD = parseFloat(process.env.CTXGUARD_THRESHOLD || "75");
const RESET = THRESHOLD - 15;
const STATE_DIR = path.join(os.homedir(), ".claude", "ctx-state");

function readPct(sessionId) {
  const override = process.env.CTXGUARD_PCT;
  if (override !== undefined && override !== "") {
    const v = parseFloat(override);
    return Number.isNaN(v) ? null : v;
  }
  try {
    return parseFloat(fs.readFileSync(path.join(STATE_DIR, sessionId), "utf8").trim());
  } catch {
    return null;
  }
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input);
  } catch {}

  const sessionId = data.session_id || "default";
  const event = data.hook_event_name || "Stop";
  const cwd = data.cwd || process.cwd();

  // Only act in projects that use project-structure.
  const snap = path.join(cwd, "meta", "structures", "project-structure.json");
  if (!fs.existsSync(snap)) return;

  const pct = readPct(sessionId);
  if (pct === null || Number.isNaN(pct)) return;

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const marker = path.join(STATE_DIR, sessionId + ".nudged-ps");

  // Hysteresis: usage dropped well below threshold (e.g. after compaction) -> re-arm.
  if (pct < RESET && fs.existsSync(marker)) {
    try {
      fs.unlinkSync(marker);
    } catch {}
  }

  if (pct < THRESHOLD || fs.existsSync(marker)) return;

  try {
    fs.writeFileSync(marker, "");
  } catch {}

  const msg =
    `[project-structure] The context window is at ~${Math.round(pct)}% and ` +
    `auto-compaction is approaching. Before continuing, update the file map now: ` +
    `run \`node meta/scripts/scan-structure.mjs --write\`, fill \`purpose\` for any ` +
    `new/changed files in meta/structures/project-structure.json, and append this ` +
    `session's structure changes to project-structure-history.jsonl — so the map ` +
    `stays accurate when the window compacts. Then continue.`;

  if (event === "Stop") {
    process.stdout.write(JSON.stringify({ decision: "block", reason: msg }));
  } else {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: event, additionalContext: msg },
      })
    );
  }
});
