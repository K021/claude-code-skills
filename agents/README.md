# agents

Shareable subagent definitions for [Claude Code](https://claude.com/claude-code), part of the **agent-harness**.

Each agent lives in `agents/<name>/` and maps to its install target under `~/.claude/agents/<name>/` (or is distributed as a plugin listed in the root `.claude-plugin/marketplace.json`, alongside the skills).

*(None yet — this directory scaffolds the harness's agent half. Add an agent as `agents/<name>/` with its definition, then list it in `marketplace.json` if distributing as a plugin.)*
