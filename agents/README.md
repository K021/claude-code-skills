# agents

Shareable subagent definitions for [Claude Code](https://claude.com/claude-code), part of the **agent-harness**.

A Claude Code agent is a single Markdown file (`~/.claude/agents/<name>.md`) with frontmatter (`name`, `description`, and optionally `model`, `tools`, …) plus a system prompt. Related agents are bundled here as a **plugin** — a directory with a `.claude-plugin/plugin.json` and a flat `agents/*.md` folder — and listed in the root [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) so they install with `/plugin` (or copy the `agents/*.md` files straight into `~/.claude/agents/`).

## Plugins here

| Plugin | What it does |
|--------|--------------|
| [**model-routing**](./model-routing/) | **Routes sub-agent (leaf) tasks to the right model by task type.** Nine `leaf-*` agents that bake in the right tier + the invariants per task type, so delegations stop silently defaulting to your priciest model. The routing is measured — real tasks replayed across three tiers, graded three ways. Agents auto-delegate by description; an `/model-routing:apply` command adds an explicit routing gate to your `CLAUDE.md`. |

*(More agents/plugins will be added here over time.)*
