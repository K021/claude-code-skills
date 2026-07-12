# Leaf routing — the measurement behind it

> **Rendered, illustrated report:** [한국어](https://k021.github.io/agent-harness/agents/model-routing/report/leaf-routing-guide.ko.html) · [English](https://k021.github.io/agent-harness/agents/model-routing/report/leaf-routing-guide.en.html) — the full per-task cards and tables. This page is the text summary.

Which model should you hand a delegated (leaf) task to, so you save cost without losing quality? This is the evidence behind the [model-routing](../) plugin: real sub-agent tasks from a real app build, replayed across **Fable / Opus / Sonnet** under identical conditions, graded three ways.

- **Scope:** 8 task types mined from a real project, replayed with 2 runs per model, plus a Fable supplement on the two hardest. ~42 measured runs.
- **Grading (3 layers):** automatic oracle (run tests / byte-compare) → verifying LLM panel (model-blind, majority-refutation on every major claim) → human blind (design only).
- **What to trust:** with 2 runs per cell, only "zero critical defects + a large gap" is treated as signal; fine differences are noise.

> Numbers below are one setup at one point in time (a specific CLI + model generation). Treat them as a starting default, not a law. A few cells are single-task or extrapolated — labeled where so.

## Terms

- **leaf** — a task the main session hands wholesale to a sub-agent: one self-contained instruction in, a result out.
- **oracle** — a machine verdict with no human judgment (run a test, compare bytes).
- **gate** — an independent adversarial review a result must pass before it's accepted.
- **major / minor** — major = should block a merge (wrong diagnosis, data loss, security). minor = worth fixing.

## The routing table

| # | Task type | Model | Required with it |
|---|---|---|---|
| 1 | Review with a given checklist | Sonnet | the checklist |
| 2 | Repair/refactor, method + oracle given | Sonnet | the oracle |
| 3 | Planning-document draft | Sonnet | (review strength scales with blast radius) |
| 4 | Coverage research (defined scope) | Sonnet | the baseline to compare against |
| 5 | Design mockups | Sonnet | "self-review via headless render capture" |
| 6 | Emergent implementation | Opus (Fable if top quality) | mandatory pre-merge adversarial gate |
| 7 | Diagnose + repair (cause unknown) | Opus (Fable if important) | same gate |
| 8 | Discovery research (find the hidden) | Opus+ | — |
| 9 | Adversarial review gate | Top tier (Fable measured best) | — |
| 10 | Strategy/execution split | **forbidden** | — |

The dividing line: **when the criterion for "done" comes from outside the executor (an oracle, a checklist, a scope, a human pick), a cheap model is enough. When the executor must find that criterion itself — what to inspect, what's hidden, whether a design holds — you need a stronger model.**

## Per type — what was measured

1. **Checklist review → Sonnet.** All 4 runs caught the planted merge-blocker; panel-noted flaws were a tie (Opus 0 and 3 vs Sonnet 1 and 2 — the cleanest and messiest reports both came from Opus, i.e. run variance > model gap). Directed review is an execution problem once the lenses are fixed.
2. **Method+oracle repair → Sonnet.** All 4 runs hit the oracle (byte-identical output on 3 documents + no crash on the deep one). Sonnet's panel flaws were 0; Opus's 4 flaws were all report-vs-artifact mismatches, not code.
3. **Plan draft → Sonnet.** Graded against 4 pitfalls the plan should have foreseen (recovered from what the real implementation later hit). Sonnet had zero critical defects; the one critical defect came from Opus. The safety net for plans is independent review, not a bigger model.
4. **Coverage research → Sonnet.** Highest coverage came from Sonnet; classification errors were minor on both sides; zero critical. The grading baseline itself had 3 errors, surfaced by the candidate runs.
5. **Design mockups → Sonnet.** Human-blind pick: best single mockup was Sonnet, a good one was Opus, and duds came from both — no model direction. The rational move is to raise the candidate count, not the model. One dud shipped a "style variable declared but unwired" bug that only a render capture catches.
6. **Emergent implementation → Opus/Fable + gate.** A concurrent-edit merge algorithm. Flawless runs: **Fable 2/2 > Opus 1/2 > Sonnet 0/2.** All 6 runs passed their own tests; 3 shipped a merge-blocker anyway. Fable ≈ 3× the cost of Opus per run. So: gate is mandatory regardless of model; reserve Fable for the hardest.
7. **Diagnose + repair → Opus, Fable if important.** A hidden-cause navigation bug. Fable was 2/2 root-cause + flawless; Sonnet had the single best run *and* the only critical defect; Opus was a flawless middle. Variance dominates — "same model twice + gate" can beat "one better run."
8. **Discovery research → Opus+.** Finding undocumented shortcuts: Opus 7 and 9 hidden finds vs Sonnet 3 and 2 — the clearest, most consistent model gap in the whole benchmark, and one a gate can't fix (a gate catches wrong findings, not missing ones). ⚠ Fable was **not** run on this task — the plugin's "top tier here" is extrapolated from the gate result (#9), not measured directly.
9. **Adversarial gate → top tier.** A natural experiment: two review panels judged the same candidates. The Fable panel invented a verification harness (replayed 30,000 random edit orderings, reproduced 291 mismatches, confirmed a one-line fix zeroed them) and found **all 3** confirmed major defects; the Opus panel, reading code, found **0**. The edge is "inventing the check you need," the same mechanism as discovery.
10. **Strategy/execution split → forbidden.** Having a top model plan the search and a cheap model execute it made hidden findings collapse to zero. Strategy is a judgment updated mid-execution — don't pre-carve it.

## The four takeaways

1. **Most work is fine on the low tier** — a ceiling effect makes all three near-identical except on the genuinely hard problems (where you must invent both the answer and the way to check it).
2. **Making it think twice beats a better model** — run variance > model gap, so "same model 2× + independent critical review" beats one pricier run. Self-authored green tests prove nothing.
3. **The low tier isn't as cheap as it looks** — ~40% cheaper per token but ~1.7× the turns, so ~10% real saving. On the same 16 task pairs: Opus $104.85 vs Sonnet $93.01.
4. **The top tier is expensive for the gap** — it edges the mid tier only on the hardest problems, at ~3× cost. Reserve it.

## Honest labels

- Cost frame: in **dollars**, downgrading barely helps (~10%). The real lever is **quota** — keeping leaf work off your priciest tier, and reserving that tier for the two roles where it measurably leads (gate, discovery).
- Small samples (2 runs/task); #8's Fable cell is extrapolated, not measured.
- Assumes a self-contained prompt (background + done-criteria + "check the current code yourself"). A one-line instruction with no context is outside what this measured.
- Not measured: long unattended runs, the quality of prompts written by a lower tier, effort-level routing.
