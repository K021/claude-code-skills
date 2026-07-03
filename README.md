# claude-code-skills

A collection of [Claude Code](https://claude.com/claude-code) skills I build and use. Each skill lives in `skills/<name>/` and maps 1:1 to its install target, `~/.claude/skills/<name>/`.

## Skills

| Skill | What it does |
|-------|--------------|
| [**project-context**](./skills/project-context/) | Gives your AI coding agent a **memory of the work**. A self-maintaining context index that survives session resets and context-window compaction, so the agent doesn't get "dumber" — reverting fixed bugs, contradicting past decisions — every time it forgets. Auto-recover · auto-update · self-GC · enforced by a git pre-commit hook. |
| [**project-structure**](./skills/project-structure/) | Gives your agent a **map of the files**. A hot index of what files exist and what each one does, recovered in a single read — so a new session stops re-discovering your codebase by `grep`. Sibling to `project-context`: that one tracks *what you're doing*, this one tracks *what exists and how it changed*. |

**The two are designed as a pair.** On recovery, `project-context` answers *"where am I and what did we decide"* while `project-structure` answers *"what files are here and what does each do"* — together they let a fresh session pick up where the last one left off instead of re-deriving everything.

*(More skills will be added here over time.)*

## Install

This repo is a **Claude Code plugin marketplace** — install natively, no npm or external tools.

**Recommended — plugin marketplace (inside Claude Code):**

```text
/plugin marketplace add K021/claude-code-skills
/plugin install project-context@claude-code-skills
/plugin install project-structure@claude-code-skills
```

That's it — everything happens inside Claude Code. Update later with `/plugin marketplace update claude-code-skills`.

> **What makes recovery automatic.** Each skill ships a **`SessionStart` hook** that injects your project's saved context/file-map into every new, resumed, or post-compaction session — that hook is the real trigger (a `CLAUDE.md` instruction alone is only a soft nudge). Then run a **one-time per-project init** — ask Claude Code to *"introduce the project-context system"* — to create the files the hook reads. So: install = skill + hook active; init = the per-project files exist. See each skill's **"How activation works"** section.

**Or — no marketplace, just copy the folder (works in any agent harness):**

```bash
git clone https://github.com/K021/claude-code-skills.git
cp -r claude-code-skills/skills/project-context ~/.claude/skills/project-context
```

Then invoke it (e.g. ask Claude Code to *"introduce the project-context system"*). See each skill's own `README.md` for details.

## What is a Claude Code skill?

A skill is a folder with a `SKILL.md` (plus any templates/scripts) that Claude Code loads on demand to give the agent a specialized capability or operating procedure. This repo ships its skills as **plugins** (each has a `.claude-plugin/plugin.json`) listed in a marketplace (`.claude-plugin/marketplace.json`), so they install with `/plugin` and update cleanly — while still working as a plain folder copy if you prefer.

## License

MIT — see [LICENSE](./LICENSE).
