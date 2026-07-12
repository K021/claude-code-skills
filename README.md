# agent-harness

My **[Claude Code](https://claude.com/claude-code) harness** — the skills and agents I build and use to customize how the coding agent works. Skills live under `skills/<name>/`, agents (bundled as plugins) under `agents/<name>/`; each maps to its install target under `~/.claude/`.

## Skills

| Skill | What it does |
|-------|--------------|
| [**project-context**](./skills/project-context/) | Gives your AI coding agent a **memory of the work**. A self-maintaining context index that survives session resets and context-window compaction, so the agent doesn't get "dumber" — reverting fixed bugs, contradicting past decisions — every time it forgets. Auto-recover · auto-update · self-GC · enforced by a git pre-commit hook. |
| [**project-structure**](./skills/project-structure/) | Gives your agent a **map of the files**. A hot index of what files exist and what each one does, recovered in a single read — so a new session stops re-discovering your codebase by `grep`. Self-reviewing in the background (sync → discovery → GC) with an append-only change history. Sibling to `project-context`: that one tracks *what you're doing*, this one tracks *what exists and how it changed*. |

**The two are designed as a pair.** On recovery, `project-context` answers *"where am I and what did we decide"* while `project-structure` answers *"what files are here and what does each do"* — together they let a fresh session pick up where the last one left off instead of re-deriving everything.

*(More skills — and agents under `agents/` — will be added here over time.)*

## Agents

| Plugin | What it does |
|--------|--------------|
| [**model-routing**](./agents/model-routing/) | **Routes sub-agent (leaf) tasks to the right model by task type.** Nine `leaf-*` agents that bake in the right tier — Sonnet for execution work, Opus for emergent/diagnosis, Fable for the adversarial gate & discovery — plus the invariants each task type needs, so a delegation stops silently defaulting to your priciest model. They **auto-delegate by description**; `/model-routing:apply` adds an explicit routing gate to your `CLAUDE.md`. The routing is measured, not guessed — real tasks replayed across three tiers and graded three ways ([the report](./agents/model-routing/report/)). |

## Install

This repo is a **Claude Code plugin marketplace** — install natively, no npm or external tools.

**Recommended — plugin marketplace (inside Claude Code):**

```text
/plugin marketplace add K021/agent-harness
/plugin install project-context@agent-harness
/plugin install project-structure@agent-harness
/plugin install model-routing@agent-harness
```

That's it — everything happens inside Claude Code. Update later with `/plugin marketplace update agent-harness`.

> **What makes recovery automatic.** Each skill ships a **`SessionStart` hook** that injects your project's saved context/file-map into every new, resumed, or post-compaction session — that hook is the real trigger (a `CLAUDE.md` instruction alone is only a soft nudge). Then run a **one-time per-project init** — ask Claude Code to *"introduce the project-context / project-structure system"* — to create the files the hook reads. So: install = skill + hook active; init = the per-project files exist. See each skill's **"How activation works"** section.
>
> **Bonus — refresh before auto-compaction.** Both skills can also refresh themselves *before* the context window compacts: their `Stop`/`PostToolBatch` hooks (shipped with the plugins) read the exact context-usage % from a small shared statusline sensor and force an update once you near the limit — so state is saved while it still exists. The hooks install automatically; the sensor can't ship in a plugin (Claude Code won't let a plugin set the statusline), so **init installs it for you** (with your approval, preserving any existing statusline). Each skill also snapshots its file via a `PreCompact` hook as a backstop. Interactive-session only; see [project-context → Context-aware refresh](./skills/project-context/#context-aware-refresh-optional-but-recommended) (and the same section in [project-structure](./skills/project-structure/#context-aware-refresh-optional-but-recommended)).

**Or — no marketplace, just copy the folder (works in any agent harness):**

```bash
git clone https://github.com/K021/agent-harness.git
cp -r agent-harness/skills/project-context ~/.claude/skills/project-context
```

Then invoke it (e.g. ask Claude Code to *"introduce the project-context system"*). See each skill's own `README.md` for details.

## What is a Claude Code skill?

A skill is a folder with a `SKILL.md` (plus any templates/scripts) that Claude Code loads on demand to give the agent a specialized capability or operating procedure. This repo ships its skills as **plugins** (each has a `.claude-plugin/plugin.json`) listed in a marketplace (`.claude-plugin/marketplace.json`), so they install with `/plugin` and update cleanly — while still working as a plain folder copy if you prefer.

## License

MIT — see [LICENSE](./LICENSE).
