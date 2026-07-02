# project-structure

> Stop letting your AI agent re-discover your files by grep every session. Give it a **file map** it recovers in one read.
>
> Part of the [**claude-code-skills**](../../README.md) collection. The sibling of [**project-context**](../project-context/).

---

## The problem: reactive re-discovery

A fresh agent session doesn't know what files exist or what each one does. So it re-derives that map on demand — `grep` here, `glob` there, open a file to guess its role — every single time. It's slow, it's noisy, and it burns context on rediscovering things you already knew last session.

`project-structure` replaces that reactive scramble with a **hot index of the file map** the agent reads once at session start.

## Sibling to project-context

The two skills split "what the agent needs to recover" cleanly:

| Skill | Answers | Holds |
|-------|---------|-------|
| [**project-context**](../project-context/) | *What am I doing? What did we decide?* | dynamic work state — summary, decisions, limitations, recent tasks |
| **project-structure** | *What files exist, what is each, and how did they change?* | a file map + a change history |

Both live in `meta/structures/`, both are **updated by the LLM** (not a static generator), and both are guarded by a pre-commit gate so the update doesn't get skipped. On recovery, project-context's `summary` tells you *where you are*; project-structure's `files[]` tells you *what's there*. No overlap: file **roles** go here, task **progress** goes in context.

## What it maintains (per project)

| File | Nature | Contents |
|------|--------|----------|
| `meta/structures/project-structure.json` | **current snapshot** (overwritten) | `files[]` — each meaningful file's `path` · `purpose` (filled by actually reading it) · `type` · `key_entrypoints_or_exports` · `related`, plus a `directories` summary |
| `meta/structures/project-structure-history.jsonl` | **append-only change log** | one line per change: `{timestamp, change_type(added\|modified\|deleted\|renamed), path, summary, related_task?}`. Never rewritten — appended only. |

Noise (`.git`, `node_modules`, `dist`/`build`, `.venv`, caches, lockfiles, `.DS_Store`, session logs…) is excluded, codified in `scan-structure.mjs`'s `EXCLUDE_*` and adjustable per project.

## The key design choice

**The script only gives you the file *list*; the LLM fills in the *meaning*.**

`scan-structure.mjs` is git-aware (`git ls-files` + noise exclusion) and does the mechanical work — list, type, diff, and *merge* (preserving existing `purpose` values, adding new files as `purpose:""`, dropping deleted ones). But it never writes `purpose`, because a filename can't tell you a file's role (a static-generated purpose is a source of stale, wrong descriptions). The agent reads each new or changed file and writes an accurate one-line `purpose`. The script handles *list · type · diff · merge*; the LLM handles *what it is and what it does*.

## Install

This is a Claude Code **skill**. Install it globally:

```bash
git clone https://github.com/K021/claude-code-skills.git
cp -r claude-code-skills/skills/project-structure ~/.claude/skills/project-structure
```

Then in any project, ask Claude Code to *"introduce the project-structure system"*. It will:

1. copy `meta/scripts/scan-structure.mjs`,
2. run `node meta/scripts/scan-structure.mjs --write` to generate the snapshot skeleton,
3. **read each file and fill in its `purpose`** (the part only the LLM can do),
4. create the `project-structure-history.jsonl` baseline.

From then on, every new session recovers the file map in one read instead of re-grepping for it.

## Repository layout

| Path | What it is |
|------|------------|
| `SKILL.md` | The skill definition — recover / update / rescan procedures. The install artifact. |
| `templates/scan-structure.mjs` | Git-aware scanner: lists files, types them, diffs vs the snapshot, merges (preserving `purpose`). The *only* static part. |
| `templates/project-structure.json` | Snapshot schema, documented inline. |
| `templates/project-structure-history.jsonl` | Append-only change-log format. |

## Note on cross-references

`SKILL.md` is published verbatim from the author's setup and references a few personal workflow conventions in brackets (e.g. `[문제 해결 방법]`) that point to the author's personal `CLAUDE.md`. They're optional context — the skill works without them.

---

## 한국어 요약

새 AI 에이전트 세션은 "어떤 파일이 있고 각각 뭘 하는지" 모릅니다. 그래서 매번 `grep`/`glob`로 파일을 **반응적으로 재발견**합니다 — 느리고, 시끄럽고, 컨텍스트를 낭비합니다.

`project-structure`는 이 반응적 탐색을, 세션 시작 시 한 번 Read하는 **파일 지도 핫 인덱스**로 대체합니다. [`project-context`](../project-context/)의 **자매 스킬** — 저쪽은 "무엇을 하는 중·결정"(동적 작업 상태), 이쪽은 "어떤 파일이 있고 어떻게 변해왔는가"(파일 지도 + 변경 이력).

프로젝트당 두 파일을 유지합니다:
- `project-structure.json` — 현재 스냅샷(덮어쓰기): 각 파일의 `path`·`purpose`(실제 read해 채움)·`type`·진입점·연관
- `project-structure-history.jsonl` — append-only 변경 원장(재작성 금지)

**핵심 설계**: 스크립트(`scan-structure.mjs`)는 *목록·타입·diff·병합*만 하고, `purpose` 같은 *의미*는 LLM이 파일을 읽어 채운다. 파일명만으론 역할을 못 맞히므로 정적 생성은 stale의 원천 — 그래서 read 기반 LLM 판단.

설치: 위 *Install* 참조 (`skills/project-structure/`를 `~/.claude/skills/project-structure/`에 복사).

---

## License

MIT — see [../../LICENSE](../../LICENSE).
