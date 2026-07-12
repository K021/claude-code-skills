# project-context

> Give your AI coding agent a **memory** — so it stops getting dumber every time the session resets.
>
> Part of the [**agent-harness**](../../README.md) collection.

A tiny context-memory system for [Claude Code](https://claude.com/claude-code) (and adaptable to other AI coding agents). It keeps a self-maintaining **hot index** of your project so a fresh session — or one that just compacted its context window — recovers "what we're building · where we are · the next step" in seconds, instead of re-deriving it and quietly producing worse work.

---

## The problem: amnesia is a performance regression

When an agent like Claude Code ends a session or compacts its context window, it loses its working memory. The cost isn't just "now I have to re-explain everything." The **quality of the output drops**:

- it reverts a bug it already fixed
- it writes code that contradicts an architecture decision made an hour ago
- it grabs the wrong file and re-explores from scratch
- it forgets the constraints and is *confidently wrong*

"Chat memory" doesn't solve this — it bloats and goes stale. The fix is to treat project context not as a full transcript, but as a **self-maintaining hot index**.

## How it works

A single JSON file — `meta/structures/project-context.json` — holds a one-line-per-item index of the project (summary, next steps, code map, key decisions, anti-patterns, open limitations, recent tasks…). Around it sit five moving parts:

1. **Auto-recover** — a bundled `SessionStart` hook injects the index's `summary` + `next_steps` into every new, resumed, or post-compaction session, so the agent restores "what we're building · where we are · the next single step" before it does anything — no file read, no reminder needed. This closes the post-amnesia quality gap.
2. **Auto-update** — on session end, the agent itself records new decisions, lessons, and next steps. So the *next* session already knows.
3. **Refresh before the window fills** — a `Stop`/`PostToolBatch` hook watches the context-usage % (fed by the statusline sensor) and, once it crosses a threshold, forces the agent to update the index *before* auto-compaction discards the live context — so the save happens while the memory is still there, not after it's gone. (See [Context-aware refresh](#context-aware-refresh-optional-but-recommended).)
4. **Self-GC** — a periodic prune pass removes stale and duplicate entries (triggered before compaction, or when the file grows past ~200 lines / 25 KB), keeping the index light *and accurate*. Stale context is its own kind of performance hit.
5. **Enforced by a git hook** — a `pre-commit` hook rejects the commit if you changed code but forgot to update the context file. The discipline isn't optional. A `PreCompact` hook also snapshots the file to `.pre-compact-backups/` as a last-resort safety net.

**The key design choice:** don't automate the updates with a static script. The *meaning* — "why we decided this," "what we learned here" — can only be extracted by the LLM. A static script only does mechanical work (like rotating old tasks into an archive). The agent maintains its own memory.

## Install

This is a Claude Code **skill**, shipped as a plugin. Install it natively — no npm required:

```text
/plugin marketplace add K021/agent-harness
/plugin install project-context@agent-harness
```

Or copy the folder directly (no marketplace, works in any harness):

```bash
git clone https://github.com/K021/agent-harness.git
cp -r agent-harness/skills/project-context ~/.claude/skills/project-context
```

> **Sibling skill:** [`project-structure`](../project-structure/) maintains a *file map* (what files exist and what each does) — the structural counterpart to this skill's *work state*. They're designed to be used together.

Then in any project, ask Claude Code to *"introduce the project-context system"* (or invoke the skill). It will:

1. create `CLAUDE.md` (entry point) from the template,
2. create `meta/structures/project-context.json` filled in from your actual code,
3. copy `meta/scripts/archive-old-tasks.py`,
4. install `.git/hooks/pre-commit`.

## How activation works (what actually makes it automatic)

Installing the plugin does two things: it makes the skill available, **and it installs a `SessionStart` hook** — that hook is the piece that makes recovery automatic. (A `CLAUDE.md` instruction alone is only a soft nudge, not a deterministic trigger; the hook *is* the trigger.)

- On every session **start, resume, or after a compaction**, the hook reads your project's `meta/structures/project-context.json` and injects its `summary` + `next_steps` straight into the session — the agent restores where you left off without being told to and without reading files.
- It's a silent no-op in projects that don't have that file, so it's safe to leave enabled everywhere.

Then, **once per project**, run init (ask Claude Code to *"introduce the project-context system"*) to create the `project-context.json` the hook reads (plus `CLAUDE.md`, the pre-commit hook, and — with your approval — the statusline sensor that powers the [pre-compaction refresh](#context-aware-refresh-optional-but-recommended)).

So: **install = skill available + `SessionStart` hook active; init (once per project) = the context file exists for the hook to read.** From then on every session auto-recovers, and every commit keeps the context current. *(Verified end-to-end: a fresh session receives the injected summary at startup with zero file reads.)*

> **Manual folder-copy installs** don't auto-register the plugin's hooks the way a marketplace `/plugin install` does. For automatic session-start recovery, install via `/plugin` — or replicate the `SessionStart` hook (`hooks/hooks.json`) in your own `settings.json`.

## Context-aware refresh (optional but recommended)

The hardest moment to survive is **auto-compaction**: when the context window fills, Claude Code compacts (summarizes-and-discards) the live conversation. If the index wasn't updated first, the freshest state is lost. Hooks can't run an LLM update themselves, and they don't receive the context-usage number — so this skill bridges it in two pieces:

1. **A statusline sensor** reads the exact `context_window.used_percentage` Claude Code hands the statusline and writes it to a per-session state file. (This is the only place Claude Code exposes precise context usage.)
2. **A `Stop` / `PostToolBatch` hook** (`hooks/ctx-guard.py`) reads that value and, once usage crosses a threshold (default 75%), forces a turn instructing the agent to refresh `summary` + `next_steps` **now** — while the context still exists. It fires once per climb (hysteresis), and only in projects that use project-context.

**The `Stop`/`PostToolBatch` hook ships with the plugin and installs automatically.** The one piece that can't ride along is the sensor — a plugin can't install a statusline (Claude Code only lets plugin settings set `agent`/`subagentStatusLine`, not the main `statusLine`). So **init sets it up for you**: when you run init (*"introduce the project-context system"*), it runs `templates/setup-statusline.sh` — with your approval, since it edits `settings.json` — which writes `~/.claude/ctx-sensor.sh` and wires your statusline to it, **preserving any existing statusline** (chained via `CTX_SENSOR_INNER`) and making a `.bak`. It's idempotent and shared with `project-structure`, so running it again (or from both skills) is a no-op. Tune the threshold with `CTXGUARD_THRESHOLD` (percent).

Prefer to wire it by hand? Run `bash statusline/setup-statusline.sh` (or the copy under either skill's `templates/`), or set it directly:

```json
// settings.json
{ "statusLine": { "type": "command", "command": "CTX_SENSOR_INNER='<your existing statusline command>' bash ~/.claude/ctx-sensor.sh" } }
```

> **Honest scope.** The statusline runs only in **interactive** Claude Code (not `-p` headless), so this refresh is an interactive-session feature. Until the sensor is wired (init does it, or run the installer), the hook is a silent no-op and the rest of the skill (recovery, git-hook enforcement, PreCompact backup) still works. Requires `jq` + `python3`.

## Repository layout

| Path | What it is |
|------|------------|
| `SKILL.md` | The skill definition — the full operating procedure (recover / update / GC / enforce). This is the install artifact. |
| `templates/CLAUDE.md` | Per-project entry point that points the agent at the context file. |
| `templates/project-context.json` | The schema, with every field documented inline. |
| `templates/pre-commit-hook.sh` | Git hook that rejects commits which change code without updating context. |
| `templates/archive-old-tasks.py` | Mechanical rotation of old `recent_tasks` into a dated archive (the *only* part that's a static script). |
| `scripts/pc-review.js` | Background 2-phase review workflow (discovery → GC) that keeps the index accurate without spending the main session's context. |
| `hooks/hooks.json` | Wires all four hook events below. |
| `hooks/session-start.py` | `SessionStart` hook — auto-injects `summary` + `next_steps` every session/resume/post-compaction (makes recovery automatic; silent no-op when the context file is absent). |
| `hooks/ctx-guard.py` | `Stop` / `PostToolBatch` hook — forces a refresh before the window fills, reading context % from the statusline sensor (see above). |
| `hooks/pre-compact-backup.py` | `PreCompact` hook — snapshots the context file to `.pre-compact-backups/` before compaction. Never blocks. |
| `templates/setup-statusline.sh` | Idempotent installer that writes the statusline sensor to `~/.claude/` and wires `settings.json` (preserving any existing statusline). Run by init with your approval; also runnable by hand. |
| `../../statusline/ctx-sensor.sh` · `../../statusline/setup-statusline.sh` | The standalone sensor + installer at repo root (`statusline/`), for manual setup. |

## Note on cross-references

`SKILL.md` is published verbatim from the author's working setup, so it references a few personal workflow conventions in brackets — e.g. `[문제 해결 방법]`, `[학습 파이프라인]`. These point to sections of the author's personal `CLAUDE.md` and are **optional context** — the skill works without them. Treat them as "this hooks into my broader workflow here," not as required dependencies.

---

## 한국어 요약

AI 코딩 에이전트(Claude Code 등)는 세션이 끊기거나 컨텍스트가 압축되면 작업 기억을 잃고, 단순히 "다시 설명해야 하는" 정도가 아니라 **결과물의 질이 떨어집니다** — 이미 고친 버그를 되돌리고, 한 시간 전 결정과 모순되는 코드를 쓰고, 제약을 잊은 채 자신 있게 틀립니다.

`project-context`는 프로젝트 컨텍스트를 *전체 기록*이 아니라 스스로 관리되는 **핫 인덱스**(`meta/structures/project-context.json`)로 다뤄 이 문제를 해결합니다:

1. **자동 회복** — 번들된 `SessionStart` 훅이 매 세션/재개/압축 후 `summary`+`next_steps`를 세션에 주입 → "무엇을 만드는 중·어디까지·다음 한 걸음"을 파일 안 읽고도 즉시 회복 (CLAUDE.md 지시는 soft nudge, 훅이 실제 트리거)
2. **자동 갱신** — 작업 종료 시 결정·교훈·다음 단계를 에이전트가 직접 기록
3. **자가 정리(GC)** — 낡고 중복된 항목을 주기적으로 도려내 인덱스를 가볍고 정확하게 유지
4. **git hook 강제** — 코드는 바꿨는데 컨텍스트를 안 갱신하면 커밋 거부

**핵심 설계**: 갱신을 정적 스크립트로 자동화하지 않는다. "왜 이 결정을 했나"·"여기서 뭘 배웠나" 같은 *의미*는 LLM만 추출할 수 있으므로, 에이전트가 스스로 자기 기억을 관리하게 한다.

설치: 위 *Install* 참조 (`SKILL.md` + `templates/`를 `~/.claude/skills/project-context/`에 복사).

---

## License

MIT — see [LICENSE](./LICENSE).
