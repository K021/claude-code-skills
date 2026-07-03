---
name: project-structure
description: 프로젝트 파일 구조·변경 이력 메타 시스템 (project-structure.json + project-structure-history.jsonl) 도입/갱신. 새 세션이 grep으로 반응적으로 파일을 재발견하지 않고, "어떤 파일이 있고 각각 무엇을 하는가"를 즉시 회복하게 한다. project-context(무엇을 하는 중·결정)의 자매 시스템 — 이쪽은 "어떤 파일이 존재하고 어떻게 변해왔는가".
---

# project-structure

> **자매 시스템 = `project-context`** (`~/.claude/skills/project-context/SKILL.md`).
> - **project-context** = *무엇을 하는 중인가 / 결정·한계·최근 작업* (동적 작업 상태).
> - **project-structure** = *어떤 파일이 존재하고 각각 무엇이며 / 어떻게 변해왔는가* (파일 지도 + 변경 이력).
> 둘 다 `meta/structures/`에 살며, 둘 다 **갱신은 LLM 책임**(정적 자동 아님)이고, 둘 다 pre-commit 게이트로 누락을 차단한다. 회복 시 project-context의 `summary`가 "지금 어디"를, project-structure의 `files[]`가 "무슨 파일"을 준다 — 상호 보완. 중복 금지: 파일 *역할*은 여기, 작업 *진행상태*는 context.

## 유지하는 두 파일 (프로젝트당)

| 파일 | 성격 | 내용 |
|---|---|---|
| `meta/structures/project-structure.json` | **현재 스냅샷** (덮어쓰기) | `files[]` — 각 의미있는 파일의 `path`·`purpose`(실제 read해 정확히)·`type`·`key_entrypoints_or_exports`·`related`. + `directories` 요약. |
| `meta/structures/project-structure-history.jsonl` | **append-only 변경 로그** | 한 줄 = 한 변경 `{timestamp, change_type(added\|modified\|deleted\|renamed), path, summary, related_task?}`. 절대 재작성 금지 — 추가만. |

**노이즈 제외**(스냅샷에 넣지 않음): `.git`, `node_modules`, `dist`/`build`/`out`, `.venv`/`__pycache__`, 각종 cache, 락파일(`package-lock.json`·`yarn.lock`·`*.lock`), `.DS_Store`, `.claw/`(세션 로그), `meta/logs`, `meta/temps`, `meta/structures/tasks-archive`, 그리고 이 두 파일 자신. (제외 목록은 `scan-structure.mjs`의 `EXCLUDE_*`에 코드화 — 프로젝트별로 조정 가능.)

## TRIGGER (project-context 트리거와 정렬)

- **프로젝트 작업 시작 시 (자동 회복)**: `meta/structures/project-structure.json`이 있으면 — **가장 먼저 Read**. 이러면 "이 파일이 뭐지?"를 grep으로 반응적으로 알아낼 필요가 없다(사용자 목표의 핵심). project-context.json과 함께 읽는다.
- **파일 생성/삭제/이름변경, 또는 파일 purpose가 실질적으로 바뀔 때**: 스냅샷 갱신 + history 한 줄 append (아래 "갱신 절차").
- **프로젝트 작업 종료 시 ([문제 해결 방법] 5단계 5-3 보강)**: 이번 작업이 파일 구조를 건드렸으면 스냅샷·history 갱신(context.json 갱신과 같은 시점).
- **패턴 부재 + `meta/` 존재 시 (자동 제안)**: `project-structure.json`이 없는데 `meta/`는 있으면 사용자에게 한 번 도입 제안(거절 시 그 세션 재제안 X). `meta/`도 없는 임시 프로젝트엔 제안 안 함.
- **누적/stale 시 (전체 재스캔)**: 오래 갱신 안 됐거나 사용자가 "구조 정리" 요청 시 아래 "전체 재스캔" 패스.

## 작업 시작 절차 (회복)

1. `meta/structures/project-structure.json` Read — `files[]`로 파일 지도 즉시 회복(어떤 파일이 뭘 하는지). `directories`로 배치 감 잡기.
2. 특정 파일을 손대기 직전에만 그 파일을 Read(스냅샷 `purpose`는 인덱스이지 소스 자체가 아니다).
3. "이 변경 전후로 뭐가 바뀌었나" 맥락이 필요하면 `project-structure-history.jsonl` tail을 읽는다.

> **회복 원칙**: 스냅샷은 *핫 인덱스*다. 새 세션이 `grep`/`glob`로 파일을 재발견하는 반응적 탐색을 이 파일 한 번 Read로 대체하는 것이 이 스킬의 존재 이유다.

## 갱신 절차 (LLM 책임 — 정적 자동 아님)

**스크립트는 *파일 목록*만 준다. `purpose`의 의미 정확성은 LLM이 파일을 실제로 읽고 채운다.**

1. **재스캔**: `node meta/scripts/scan-structure.mjs --diff` 로 현재 스냅샷 대비 추가/삭제된 파일을 먼저 본다(stderr에 `[added]`/`[deleted]`).
2. **스켈레톤 병합 쓰기**: `node meta/scripts/scan-structure.mjs --write` — 기존 `purpose`/`key_entrypoints_or_exports`/`related`는 **보존**되고, 새 파일은 `purpose:""`로, 삭제된 파일은 `files[]`에서 빠진다. (스크립트는 git-aware: `git ls-files --cached --others --exclude-standard` + 노이즈 제외.)
3. **purpose 채우기 (핵심·LLM 전담)**: `purpose == ""` 인 새 파일, 그리고 이번 작업으로 *역할이 바뀐* 파일을 **실제로 Read**하고 한 줄 `purpose`를 정확히 쓴다(추측 금지 — "무엇이고 무엇을 하는가"). 관련 시 `key_entrypoints_or_exports`(export 함수/CLI 플래그/리슨 포트)·`related`(연결 파일)도 채운다.
4. **history append**: 이번 세션의 각 파일 변경마다 `project-structure-history.jsonl`에 한 줄 append —
   - added: 새 파일 생성. `renamed`: 경로 변경(summary에 old→new). `deleted`: 제거. `modified`: purpose가 실질적으로 바뀐 경우만(사소한 편집은 로그하지 않는다 — history는 *구조/의미* 변경 로그이지 커밋 로그가 아니다).
   - `summary`는 "무엇이 어떻게 왜"를, `related_task`는 있으면 context.json의 recent_tasks id를 건다.
5. **`updated_at`** 를 현재 ISO8601 절대시각으로.
6. **검증**: `node -e "JSON.parse(require('fs').readFileSync('meta/structures/project-structure.json'))"` 로 유효성, history는 각 줄 유효 JSON인지(`while read l; do echo "$l" | node -e '...' ; done` 또는 `jq -c . file.jsonl > /dev/null`).

> **왜 스크립트가 purpose를 안 채우나**: 파일명·확장자로는 *역할*을 못 맞춘다(예: `reasoning-proxy.mjs`가 "LM Studio 스트리밍 reasoning 프록시"인지 스크립트는 모른다). 정적 생성 purpose는 stale·부정확의 원천이라 반드시 read 기반 LLM 판단. 스크립트는 *목록·타입·병합·diff*만 담당.

## 전체 재스캔 (GC / 정합) 절차 — stale 의심·사용자 요청 시

### 실행: 백그라운드 위임 (sync → discovery → GC) — 기본

검토·정리는 **메인이 인라인으로 돌리지 않는다.** 백그라운드 워크플로 `scripts/ps-review.js`에 위임한다(`Workflow({ scriptPath: "~/.claude/skills/project-structure/scripts/ps-review.js", args: { projectRoot: "<프로젝트 절대경로>" } })`). project-context의 `pc-review.js`와 자매.

- **왜 백그라운드인가**: purpose 검증은 *파일 다수를 Read*하는 작업이라 인라인이면 메인 컨텍스트를 잡아먹고(검토 chatter) abort를 유발한다. 워커가 파일을 *디스크에서 직접 Edit*하므로 메인엔 짧은 요약(`{sync, discovery, gc, finalize}`)만 돌아온다.
- **3-phase·각 1회 수렴·바깥 반복 없음**: ① **Sync**(`scan-structure.mjs --write`로 파일 목록 기계적 동기화 — 새 파일 purpose:"", 삭제 파일 제거) → ② **Discovery**(빈/빈약한 purpose·entrypoint·related·directories를 파일 Read해 보강, loop-until-dry) → ③ **GC**(유령파일·stale purpose·없어진 디렉토리·변동성 값 prune/correct). 바깥 루프 금지(진동 위험).
- **🚫 history 불가침**: `project-structure-history.jsonl`은 append-only 원장이라 워크플로가 **절대 재작성/prune하지 않는다** — 스냅샷 json만 정리. (pc-review와의 결정적 차이.)
- **불변식**(sequential-review 참조): 라운드마다 *새 독립* `agentType:'general-purpose'` · 현재 파일 *재독* · purpose는 파일 Read로 *접지* · 발견은 파일에 *직접 Edit*.
- **compact 직전 트리거**: 백그라운드라 *이번* 압축 전 완료를 보장 못 해도 파일은 유효한 증분본이고, 워커가 압축 후 끝내 정리해 **다음 회복은 정리본으로**(자가 치유). 막판 인라인으로 abort 내지 마라.

> 아래 단계는 **각 phase의 점검 항목 명세**(Sync=1, Discovery=2, GC=3·4)이자 워크플로를 못 쓸 때의 **인라인 폴백 절차**다.

1. `scan-structure.mjs --write` 로 목록을 현재 디스크와 동기화(사라진 파일 자동 제거·새 파일 등장).
2. 남아있는 각 `purpose`가 *지금도 맞는가*를 접지: 의심되는 파일은 Read해서 역할이 바뀌었으면 정정. 라인번호 같은 변동에 약한 값은 넣지 말고 *의미*로 기술.
3. `directories`가 실제 배치와 맞는가. 없어진 디렉토리 제거.
4. history는 **prune하지 않는다**(append-only 원장). 비대해지면 오래된 것을 `meta/structures/structure-history-archive/`로 옮기되(연/월 단위) 원본 라인은 보존.
5. `updated_at` 갱신 + JSON 유효성 검증.

> project-context의 GC처럼 "없는 핵심 보강 → 접지 → prune" 흐름을 따르되, **history는 원장이라 절대 재작성/삭제하지 않고 archive만** 한다는 점이 다르다.

## 새 프로젝트 도입 (init) — 절차

1. `meta/scripts/scan-structure.mjs` 복사 — `templates/scan-structure.mjs` 그대로.
2. `node meta/scripts/scan-structure.mjs --write` — `meta/structures/project-structure.json` 스켈레톤 생성.
3. **각 파일 Read → `purpose` 채우기** (LLM 전담, 위 갱신 절차 3).
4. `meta/structures/project-structure-history.jsonl` 생성 — baseline. 판단에 따라 파일당 `added (baseline snapshot)` 한 줄씩, 또는 단일 baseline 엔트리.
5. `updated_at`·`root` 확정, JSON 유효성 검증.
6. (선택) pre-commit 게이트: project-context의 `pre-commit-hook.sh`에 이미 "코드 변경 시 context.json 갱신 강제"가 있다. 구조 파일도 강제하려면 그 훅에 `project-structure.json` 조건을 OR로 추가하거나 `templates/pre-commit-hook.sh`(구조 전용) 사용. 게이트 철학은 project-context와 동일 — LLM이 5단계 5-3 갱신을 빠뜨리는 것을 reject로 차단.
7. **(권장) statusline 센서 설정** — "압축 전 자동 갱신"(ctx-guard 훅 #2)을 활성화한다. `~/.claude/settings.json`을 수정하므로 **사용자 승인 후** `bash templates/setup-statusline.sh` 실행(멱등·기존 statusline은 `CTX_SENSOR_INNER`로 보존·`.bak` 생성). 훅은 플러그인에 담기지만 statusline은 못 담기므로(Claude Code 제약) init이 대신 깐다. project-context와 **공유** — 이미 깔렸으면 no-op. `jq`·`python3` 필요.

## 스키마 — `project-structure.json`

```jsonc
{
  "$schema_version": 1,
  "updated_at": "ISO8601 절대시각",
  "root": "<절대경로>",
  "directories": { "<dir 또는 (root)>": "<역할/파일수>" },
  "files": [
    {
      "path": "<루트 기준 상대경로>",
      "purpose": "<무엇이고 무엇을 하는가 — read 기반, 추측 금지>",
      "type": "<javascript(esm)/python/json/markdown/shell/...>",
      "key_entrypoints_or_exports": ["<export 함수/CLI 플래그/포트/심볼 — 없으면 []>"],
      "related": ["<연결된 파일 상대경로>"]
    }
  ]
}
```

## 스키마 — `project-structure-history.jsonl` (append-only)

```jsonc
// 한 줄 = 한 변경 이벤트
{"timestamp":"ISO8601","change_type":"added|modified|deleted|renamed","path":"<상대경로>","summary":"<무엇이 어떻게 왜>","related_task":"<선택: recent_tasks id>"}
```

- `renamed`: `path`는 새 경로, `summary`에 `old → new`.
- **원장 규칙**: 이 파일은 재작성/삭제하지 않는다. 잘못 적었으면 정정 엔트리를 새로 append. 비대 시 archive만.

## 갱신을 정적 스크립트로 자동화하지 마라

`purpose`·`summary`·`related` 같은 의미 필드는 LLM 판단(파일 read). `scan-structure.mjs`는 *목록·타입·diff·병합*만 한다 — 이 경계를 지켜야 스냅샷이 정확하게 유지된다.

## 디렉토리

- 본 skill: `~/.claude/skills/project-structure/`
- 템플릿: `~/.claude/skills/project-structure/templates/` (`scan-structure.mjs`, `project-structure.json`, `project-structure-history.jsonl`)
- 사용처: 각 프로젝트의 `meta/structures/`(두 파일), `meta/scripts/scan-structure.mjs`
