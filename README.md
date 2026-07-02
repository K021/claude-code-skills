# claude-code-skills

A collection of [Claude Code](https://claude.com/claude-code) skills I build and use. Each skill lives in `skills/<name>/` and maps 1:1 to its install target, `~/.claude/skills/<name>/`.

## Skills

| Skill | What it does |
|-------|--------------|
| [**project-context**](./skills/project-context/) | Gives your AI coding agent a **memory of the work**. A self-maintaining context index that survives session resets and context-window compaction, so the agent doesn't get "dumber" — reverting fixed bugs, contradicting past decisions — every time it forgets. Auto-recover · auto-update · self-GC · enforced by a git pre-commit hook. |
| [**project-structure**](./skills/project-structure/) | Gives your agent a **map of the files**. A hot index of what files exist and what each one does, recovered in a single read — so a new session stops re-discovering your codebase by `grep`. Sibling to `project-context`: that one tracks *what you're doing*, this one tracks *what exists and how it changed*. |

**The two are designed as a pair.** On recovery, `project-context` answers *"where am I and what did we decide"* while `project-structure` answers *"what files are here and what does each do"* — together they let a fresh session pick up where the last one left off instead of re-deriving everything.

*(More skills will be added here over time.)*

## Installing a skill

Each skill is a self-contained folder under `skills/`. To install one globally for Claude Code:

```bash
git clone https://github.com/K021/claude-code-skills.git
# copy the skill folder you want into ~/.claude/skills/
cp -r claude-code-skills/skills/project-context ~/.claude/skills/project-context
```

Then invoke it from Claude Code (e.g. ask it to *"introduce the project-context system"*). See each skill's own `README.md` for details.

## What is a Claude Code skill?

A skill is a folder with a `SKILL.md` (plus any templates/scripts) that Claude Code loads on demand to give the agent a specialized capability or operating procedure. Dropping a skill into `~/.claude/skills/<name>/` makes it available across all your projects.

## License

MIT — see [LICENSE](./LICENSE).
