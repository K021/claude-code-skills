# model-routing

**Route sub-agent (leaf) tasks to the right model by task type.** Part of the [agent-harness](../../).

When you delegate a task to a sub-agent in Claude Code and don't name a model, it silently runs on your **session model — usually your priciest tier**. You end up burning top-tier quota on trivial reviews. This plugin ships nine `leaf-*` agents that each bake in the right model and the invariants for their task type, so delegations route themselves instead of defaulting up.

The routing isn't a guess — it comes from replaying real tasks from a real app build across three model tiers and grading them three ways (automatic oracle → verifying LLM panel → human blind). Read the report, rendered: **[한국어](https://k021.github.io/agent-harness/agents/model-routing/report/leaf-routing-guide.ko.html)** · **[English](https://k021.github.io/agent-harness/agents/model-routing/report/leaf-routing-guide.en.html)** (or the [source & summary](./report/)).

## The routing table

| Task type | Agent | Tier | Why |
|---|---|---|---|
| Review with a given checklist / lenses | `leaf-checklist-review` | low (sonnet) | directed review ties the top model's recall |
| Repair/refactor with method **and** oracle given | `leaf-oracle-repair` | low (sonnet) | full marks, zero merge-blockers |
| Planning-document draft | `leaf-plan-draft` | low (sonnet) | zero critical defects |
| Coverage research (defined scope) | `leaf-coverage-research` | low (sonnet) | tied best coverage |
| Design mockups (human picks) | `leaf-design-mockup` | low (sonnet) | no model direction — raise candidate count instead |
| Emergent implementation (design is yours) | `leaf-emergent-impl` | mid (opus) | + **mandatory** `leaf-adversarial-gate` before merge |
| Diagnose + repair (cause unknown) | `leaf-diagnose-repair` | mid (opus) | + gate before merge |
| Discovery research (find the hidden) | `leaf-discovery-research` | top | the one place a top model measurably leads |
| Adversarial gate (block bad merges) | `leaf-adversarial-gate` | top | found 3/3 merge-blockers a mid reviewer missed |

The agents **auto-delegate by description** — once installed, Claude reads the descriptions and routes tasks to the right one on its own. Run `/model-routing:apply` (below) to also add an explicit routing gate to your `CLAUDE.md`.

> **Top tier = Fable.** The two top-tier agents (gate, discovery) ship with `model: fable` — this is the one place Fable's cost is worth it. **No Fable?** An unavailable model errors (it doesn't silently downgrade), so change those two to `model: opus` — or just run `/model-routing:apply`, which detects it and does it for you.

## The four findings behind it

1. **Most work is fine on the low tier.** Except for the genuinely hard problems, all three tiers hit a ceiling and produce near-identical results. "Hard" = you must invent both the answer *and* the way to check it (e.g. a conflict-free merge for two people editing the same line).
2. **Making it think twice beats a better model.** Run-to-run variance was larger than the gap between models — the same model produced both the best and the worst result on the same task. So "same model twice + pick the better with an independent critical review" beats "one run of a pricier model." Half of the hardest-task runs passed all their own tests while carrying a merge-blocking defect; an independent reviewer caught every one.
3. **The low tier isn't as cheap as it looks.** ~40% cheaper per token, but it spends more tokens on the same task (~1.7× the turns), so the real saving is ~10%. If you're not tight on quota, defaulting to the mid tier is fine.
4. **The top tier is expensive for the gap.** On the hardest problems the top tier occasionally solves what the mid tier gets wrong — but at ~3× the cost. Reserve it for what the mid tier can't crack, or when you want the best regardless of cost. Most hard problems come out the same on both.

## Install

**Plugin marketplace (recommended, inside Claude Code):**

```text
/plugin marketplace add K021/agent-harness
/plugin install model-routing@agent-harness
/model-routing:apply          # optional: adds the routing gate to your CLAUDE.md, mapped to your models
```

That's it — the nine agents are now available and auto-delegate. Update later with `/plugin marketplace update agent-harness`.

**Or copy the folder (works in any Claude Code setup):**

```bash
git clone https://github.com/K021/agent-harness.git
cp agent-harness/agents/model-routing/agents/*.md ~/.claude/agents/
```

Then, optionally, add the routing gate from [`commands/apply.md`](./commands/apply.md) to your `CLAUDE.md` by hand.

## Applying it with one line (to an LLM)

Since the agents are plain Markdown, you can also just tell your Claude:

```text
Read https://github.com/K021/agent-harness/tree/main/agents/model-routing
and set up this leaf model-routing in my harness, mapped to my models.
```

## Adapting to your own tasks

The routing above is a **measured default for one setup, one point in time**. A few cells rest on small samples (two runs per task) and one is extrapolated from an adjacent result. It should transfer as a starting point, but if a routing decision matters to you, re-measure on your own tasks — the [report](./report/) documents the method.

## License

MIT — see [LICENSE](../../LICENSE).
