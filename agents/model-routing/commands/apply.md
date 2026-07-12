---
description: Add the leaf model-routing gate to your CLAUDE.md and tailor it to your model lineup.
---

You are wiring the `model-routing` plugin's routing gate into the user's harness. The plugin's `leaf-*` sub-agents are already installed and already auto-delegate by their descriptions; this command adds the explicit routing gate to CLAUDE.md (which a plugin cannot edit on its own) and tailors it to the user's models.

Do this:

1. **Ask which CLAUDE.md** to edit — the global `~/.claude/CLAUDE.md` (applies everywhere) or the current project's `CLAUDE.md`. Default to global if the user doesn't care.

2. **Check the top tier.** The two top-tier agents (`leaf-adversarial-gate`, `leaf-discovery-research`) ship with `model: fable`. Ask: "Do you have Fable available?"
   - If **yes**: leave them; the block's gate/discovery line reads `→ fable`.
   - If **no**: those two would error on use (an unavailable model returns 404 — it does not downgrade). Find both agent files (in the installed plugin, or in `~/.claude/agents/` if the user copied them) and change their frontmatter `model: fable` → `model: opus`, and use `opus` in the block below. Warn the user that a later `/plugin marketplace update` may restore `fable`, so they can re-run this command.

3. **Add this block to the chosen CLAUDE.md** (create the file if absent; if a `[leaf model routing]` block already exists, update it rather than duplicating). Substitute the top-tier model per step 2:

   ```markdown
   ## [leaf model routing — gate before every delegation]

   > When delegating a task to a sub-agent, route by type (measured on a real app build — see the model-routing plugin).

   1. Delegate via the `leaf-*` agents (model + rules baked in; a bare general-purpose delegation silently runs on your session model = your priciest tier). First match wins (if emergent + diagnosis blur, pick the more conservative one):
      - checklist review → leaf-checklist-review · method+oracle repair → leaf-oracle-repair · plan draft → leaf-plan-draft · coverage research → leaf-coverage-research · design mockup → leaf-design-mockup  (low tier; supply the checklist / oracle / scope / render-capture instruction — if missing, the agent escalates)
      - emergent implementation → leaf-emergent-impl · diagnose + repair → leaf-diagnose-repair  (mid tier + mandatory leaf-adversarial-gate before merge)
      - discovery research → leaf-discovery-research · adversarial gate → leaf-adversarial-gate  (TOP tier — don't cheap out)
   2. Never: split strategy (top model plans the search) from execution (cheap model runs it) — discovery dies. Never use "the executor's own tests pass" as a completion criterion — the check must come from outside the executor.
   3. Trap: a `model` override applies only to the first spawn — resumed turns fall back to the session model. Design routing-critical work as one-shot.
   ```

4. **Confirm before writing.** Show the user the exact block and the target file, then apply it.

5. **Tell the user** the agents already auto-delegate by description, so routing works immediately; this block just makes it explicit and reliable. Point them at the plugin README for the routing table and the measurement report.
