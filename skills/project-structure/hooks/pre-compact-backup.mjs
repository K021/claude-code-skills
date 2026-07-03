#!/usr/bin/env node
// PreCompact safety net for project-structure.
//
// Before context compaction, copy project-structure.json to a timestamped
// backup so a mechanical snapshot survives even if the model didn't refresh the
// map in time. Does NOT block compaction. Silent no-op when absent. Keeps the
// 10 most recent backups. (The history .jsonl is append-only, so it doesn't need
// backing up — it can't lose data.)
import fs from "node:fs";
import path from "node:path";

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let data = {};
  try {
    data = JSON.parse(input);
  } catch {}

  const cwd = data.cwd || process.cwd();
  const src = path.join(cwd, "meta", "structures", "project-structure.json");
  if (!fs.existsSync(src)) return;

  const dir = path.join(cwd, "meta", "structures", ".pre-compact-backups");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, `project-structure-${stamp()}.json`));
  } catch {
    return; // never break compaction
  }

  // Retain only the 10 most recent structure backups.
  try {
    const backups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("project-structure-") && f.endsWith(".json"))
      .sort();
    for (const old of backups.slice(0, -10)) {
      fs.unlinkSync(path.join(dir, old));
    }
  } catch {}
});
