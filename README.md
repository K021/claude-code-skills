# claude-project-context

> Give your AI coding agent a **memory** — so it stops getting dumber every time the session resets.

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

A single JSON file — `meta/structures/project-context.json` — holds a one-line-per-item index of the project (summary, next steps, code map, key decisions, anti-patterns, open limitations, recent tasks…). Around it sit four moving parts:

1. **Auto-recover** — on session start, the agent reads the index first, instantly restoring "what we're building · where we are · the next single step." This closes the post-amnesia quality gap.
2. **Auto-update** — on session end, the agent itself records new decisions, lessons, and next steps. So the *next* session already knows.
3. **Self-GC** — a periodic prune pass removes stale and duplicate entries (triggered before compaction, or when the file grows past ~200 lines / 25 KB), keeping the index light *and accurate*. Stale context is its own kind of performance hit.
4. **Enforced by a git hook** — a `pre-commit` hook rejects the commit if you changed code but forgot to update the context file. The discipline isn't optional.

**The key design choice:** don't automate the updates with a static script. The *meaning* — "why we decided this," "what we learned here" — can only be extracted by the LLM. A static script only does mechanical work (like rotating old tasks into an archive). The agent maintains its own memory.

## Install

This is a Claude Code **skill**. To install it globally:

```bash
git clone https://github.com/K021/claude-project-context.git
mkdir -p ~/.claude/skills/project-context
cp claude-project-context/SKILL.md ~/.claude/skills/project-context/SKILL.md
cp -r claude-project-context/templates ~/.claude/skills/project-context/templates
```

Then in any project, ask Claude Code to *"introduce the project-context system"* (or invoke the skill). It will:

1. create `CLAUDE.md` (entry point) from the template,
2. create `meta/structures/project-context.json` filled in from your actual code,
3. copy `meta/scripts/archive-old-tasks.py`,
4. install `.git/hooks/pre-commit`.

From then on, every new session recovers context automatically, and every commit keeps the context current.

## Repository layout

| Path | What it is |
|------|------------|
| `SKILL.md` | The skill definition — the full operating procedure (recover / update / GC / enforce). This is the install artifact. |
| `templates/CLAUDE.md` | Per-project entry point that points the agent at the context file. |
| `templates/project-context.json` | The schema, with every field documented inline. |
| `templates/pre-commit-hook.sh` | Git hook that rejects commits which change code without updating context. |
| `templates/archive-old-tasks.py` | Mechanical rotation of old `recent_tasks` into a dated archive (the *only* part that's a static script). |

## Note on cross-references

`SKILL.md` is published verbatim from the author's working setup, so it references a few personal workflow conventions in brackets — e.g. `[문제 해결 방법]`, `[학습 파이프라인]`. These point to sections of the author's personal `CLAUDE.md` and are **optional context** — the skill works without them. Treat them as "this hooks into my broader workflow here," not as required dependencies.

---

## 한국어 요약

AI 코딩 에이전트(Claude Code 등)는 세션이 끊기거나 컨텍스트가 압축되면 작업 기억을 잃고, 단순히 "다시 설명해야 하는" 정도가 아니라 **결과물의 질이 떨어집니다** — 이미 고친 버그를 되돌리고, 한 시간 전 결정과 모순되는 코드를 쓰고, 제약을 잊은 채 자신 있게 틀립니다.

`claude-project-context`는 프로젝트 컨텍스트를 *전체 기록*이 아니라 스스로 관리되는 **핫 인덱스**(`meta/structures/project-context.json`)로 다뤄 이 문제를 해결합니다:

1. **자동 회복** — 세션 시작 시 "무엇을 만드는 중·어디까지·다음 한 걸음"을 즉시 읽음
2. **자동 갱신** — 작업 종료 시 결정·교훈·다음 단계를 에이전트가 직접 기록
3. **자가 정리(GC)** — 낡고 중복된 항목을 주기적으로 도려내 인덱스를 가볍고 정확하게 유지
4. **git hook 강제** — 코드는 바꿨는데 컨텍스트를 안 갱신하면 커밋 거부

**핵심 설계**: 갱신을 정적 스크립트로 자동화하지 않는다. "왜 이 결정을 했나"·"여기서 뭘 배웠나" 같은 *의미*는 LLM만 추출할 수 있으므로, 에이전트가 스스로 자기 기억을 관리하게 한다.

설치: 위 *Install* 참조 (`SKILL.md` + `templates/`를 `~/.claude/skills/project-context/`에 복사).

---

## License

MIT — see [LICENSE](./LICENSE).
