#!/usr/bin/env node
/**
 * scan-structure.mjs — project-structure skill helper (assist, not authority)
 *
 * Lists the project's meaningful files (respecting .gitignore + a noise
 * exclude list) and emits a JSON skeleton for meta/structures/project-structure.json.
 * It PRESERVES per-file `purpose`/`key_entrypoints_or_exports`/`related` already
 * present in the existing snapshot (the LLM owns those semantic fields — this
 * script never guesses them). New files appear with purpose "" for the LLM to fill;
 * deleted files are dropped from `files[]` and reported on stderr so the LLM can
 * append a "deleted" history entry.
 *
 * Usage:
 *   node meta/scripts/scan-structure.mjs                 # print merged snapshot to stdout
 *   node meta/scripts/scan-structure.mjs --write         # write meta/structures/project-structure.json
 *   node meta/scripts/scan-structure.mjs --diff          # only print added/deleted vs current snapshot
 *   node meta/scripts/scan-structure.mjs --root <path>   # override project root (default: git toplevel or cwd)
 *
 * The LLM then Reads each new/changed file and fills `purpose` etc. by hand.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const DIFF_ONLY = args.includes('--diff');
const rootIdx = args.indexOf('--root');

function gitToplevel() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return process.cwd();
  }
}

const ROOT = rootIdx !== -1 ? path.resolve(args[rootIdx + 1]) : gitToplevel();
const SNAPSHOT = path.join(ROOT, 'meta/structures/project-structure.json');

// Noise: never listed as meaningful files. Directory prefixes + glob-ish suffixes.
const EXCLUDE_DIR_PREFIXES = [
  '.git/', 'node_modules/', 'dist/', 'build/', 'out/', '.next/', '.nuxt/',
  '.venv/', 'venv/', '__pycache__/', '.pytest_cache/', '.mypy_cache/',
  '.cache/', '.turbo/', 'coverage/', '.claw/', '.idea/', '.vscode/',
  'meta/logs/', 'meta/temps/', 'meta/structures/tasks-archive/',
];
const EXCLUDE_EXACT = new Set([
  '.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'poetry.lock', 'Cargo.lock', 'composer.lock', 'Gemfile.lock', 'uv.lock',
]);
const EXCLUDE_SUFFIX = ['.pyc', '.pyo', '.log', '.tmp', '.DS_Store'];

function isNoise(rel) {
  if (EXCLUDE_EXACT.has(path.basename(rel))) return true;
  if (EXCLUDE_DIR_PREFIXES.some((p) => rel === p.slice(0, -1) || rel.startsWith(p))) return true;
  if (EXCLUDE_SUFFIX.some((s) => rel.endsWith(s))) return true;
  // The snapshot + history themselves are meta bookkeeping, not "meaningful source".
  if (rel.startsWith('meta/structures/project-structure')) return true;
  return false;
}

// Detect a coarse language/type from extension (LLM refines `purpose`).
const TYPE_BY_EXT = {
  '.mjs': 'javascript (esm)', '.cjs': 'javascript (commonjs)', '.js': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript (react)', '.jsx': 'javascript (react)',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.rb': 'ruby', '.java': 'java',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.json': 'json', '.jsonl': 'jsonl', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.md': 'markdown', '.txt': 'text', '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.sql': 'sql', '.env': 'dotenv', '.bak': 'backup',
};
function detectType(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (TYPE_BY_EXT[ext]) return TYPE_BY_EXT[ext];
  if (path.basename(rel) === 'Dockerfile') return 'dockerfile';
  if (path.basename(rel) === 'Makefile') return 'makefile';
  return ext ? ext.slice(1) : 'file';
}

// git-aware file listing: tracked + untracked-but-not-ignored (respects .gitignore).
function listFiles() {
  let out;
  try {
    // -c core.quotePath=false: keep UTF-8 (e.g. Korean) filenames intact instead of \NNN-octal quoting.
    out = execSync('git -c core.quotePath=false ls-files --cached --others --exclude-standard', {
      cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    // Not a git repo — fall back to a plain recursive walk.
    out = '';
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const abs = path.join(dir, name);
        const rel = path.relative(ROOT, abs);
        if (isNoise(rel + (fs.statSync(abs).isDirectory() ? '/' : ''))) continue;
        if (fs.statSync(abs).isDirectory()) walk(abs);
        else out += rel + '\n';
      }
    };
    walk(ROOT);
  }
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))]
    .filter((rel) => !isNoise(rel))
    .sort();
}

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
  } catch {
    return null;
  }
}

function directoriesSummary(files) {
  const dirs = {};
  for (const f of files) {
    const d = path.dirname(f);
    const key = d === '.' ? '(root)' : d;
    dirs[key] = (dirs[key] || 0) + 1;
  }
  return dirs;
}

function build() {
  const files = listFiles();
  const existing = loadExisting();
  const prevByPath = new Map((existing?.files || []).map((f) => [f.path, f]));

  const merged = files.map((rel) => {
    const prev = prevByPath.get(rel);
    return {
      path: rel,
      purpose: prev?.purpose ?? '',           // LLM-owned: "" means fill me
      type: detectType(rel),
      key_entrypoints_or_exports: prev?.key_entrypoints_or_exports ?? [],
      related: prev?.related ?? [],
    };
  });

  const nowSet = new Set(files);
  const added = files.filter((f) => !prevByPath.has(f));
  const deleted = [...prevByPath.keys()].filter((f) => !nowSet.has(f));

  const snapshot = {
    $schema_version: 1,
    updated_at: existing?.updated_at ?? 'FILL-ISO8601',
    root: ROOT,
    directories: directoriesSummary(files),
    files: merged,
  };
  return { snapshot, added, deleted };
}

const { snapshot, added, deleted } = build();

if (added.length) console.error(`[added] ${added.length}:\n  ${added.join('\n  ')}`);
if (deleted.length) console.error(`[deleted] ${deleted.length}:\n  ${deleted.join('\n  ')}`);
if (!added.length && !deleted.length) console.error('[diff] no file-level add/delete vs current snapshot');

if (DIFF_ONLY) process.exit(0);

const json = JSON.stringify(snapshot, null, 2) + '\n';
if (WRITE) {
  fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
  fs.writeFileSync(SNAPSHOT, json);
  console.error(`[write] ${SNAPSHOT} (${snapshot.files.length} files) — now fill empty "purpose" fields by reading each file`);
} else {
  process.stdout.write(json);
}
