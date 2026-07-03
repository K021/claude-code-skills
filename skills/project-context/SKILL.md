---
name: project-context
description: 프로젝트별 컨텍스트 메타 시스템 (project-context.json) 도입/갱신. 새 세션이 작업 시작 시 즉시 컨텍스트 회복하고, 작업 종료 시 정확히 갱신할 수 있게 한다.
---

# project-context

## TRIGGER
- **프로젝트 작업 시작 시 (자동 회복)**: 그 프로젝트에 `CLAUDE.md` + `meta/structures/project-context.json` 둘 다 있으면 — 둘 다 read 후 사용자 prompt 처리.
- **패턴 부재 + `meta/` 디렉토리 존재 시 (자동 제안)**: `CLAUDE.md` 또는 `project-context.json`이 없는데 `meta/` 디렉토리는 있다면(=메타 시스템 의도) — **사용자에게 한 번 도입 제안**: "이 프로젝트에 project-context 시스템을 도입할까요?" 사용자가 거절하면 그 세션 동안 재제안 X. `meta/` 자체도 없는 임시 프로젝트엔 제안 안 함.
- **프로젝트 작업 종료 시 (5단계 5-3 보강)**: `meta/structures/project-context.json` **증분 갱신**(아래 "작업 종료 절차").
- **compaction 직전 / 누적 트리거 / 사용자 요청 시 (전체 새로고침)**: 증분 append만 쌓이면 파일이 stale·비대해진다. 아래 셋 중 하나면 **전체 새로고침(GC) 패스**를 돈다(아래 "전체 새로고침(GC) 절차") — 증분과 달리 *기존 항목을 접지 검증하고 stale/불필요를 제거*한다:
  - **(a) compact 직전** — 컨텍스트가 곧 압축돼 회복이 이 파일에 의존.
  - **(b) 누적 트리거**(측정 가능) — 마지막 GC 이후 증분 종료가 **≥5회 누적**(= recent_tasks 5건 추가) **또는** 파일이 **200줄/25KB 초과**(`wc -lc meta/structures/project-context.json`). 둘 중 먼저 도달 시.
  - **(c) 사용자 요청** — "context 정리/GC" 등.
- **새 프로젝트에 처음 도입 시**: 사용자가 "context 도입" / "/project-context init" 등으로 명시 호출, 또는 위 자동 제안 수락 시.

## 작업 시작 절차 (회복)
1. `<project>/CLAUDE.md` read (자동)
2. **`<project>/meta/structures/project-context.json` read** — `summary` 먼저(지금 어디까지·다음 한 걸음), 이어 `next_steps`(앞으로 할 일 로드맵)·정체성/코드 구조/결정/한계/보류/최근 작업/워크플로 즉시 파악
3. 사용자 prompt 처리. 상세는 `meta/specs|plans|reports/` 또는 `meta/structures/tasks-archive/`로 drill-in.

## 작업 종료 절차 (갱신, [문제 해결 방법] 5단계 5-3)
**현재 세션 LLM 책임** — 정적 자동 X. git log/diff 보고 의미 추출:

- `summary` 최신화: "지금 어디까지·바로 다음 한 걸음"을 이번 작업 반영해 다시 씀(compact 회복 1순위·가장 stale 되기 쉬움)
- `next_steps` 최신화: 이번 작업으로 끝난 항목 제거, 새로 *계획된* 앞으로 할 일을 순서대로 추가(0~5개 한 줄). `summary`엔 그 중 첫 걸음만, 나머지 로드맵은 여기에. (deferred_work과 구분 — deferred는 사유 있는 *보류*, next_steps는 *바로 이어 할* 예정)
- `active_tasks`에서 이 작업 entry 제거 → `recent_tasks` 맨 앞에 완료 entry로 이동(상세는 "운영 절차 > active_tasks 사용")
- `recent_tasks` 맨 앞 새 작업: `{ id, title, ref_report, completed_at }`
- 새 결정: `key_decisions` 추가 — `{ topic, current, lesson, ref_report }`
- 새 한계: `open_limitations` 한 줄 추가
- 보류 작업: `deferred_work` 추가 — `{ id, title, reason }`
- 해당 시: `anti_patterns`(반복 실수)·`glossary`(새 도메인 용어)·`non_goals`(새 비목표) 추가 (저-churn — 정리·중복제거는 GC 패스 책임)
- 코드 파일 추가/제거 시: `code_map` 갱신
- `updated_at` ISO8601 현재 시각으로 갱신
- `recent_tasks`가 11건 이상: archive 회전 (`/usr/bin/python3 meta/scripts/archive-old-tasks.py` — 10건 초과분만 `tasks-archive/<YYMM>.json`으로 이동)

> 증분 갱신은 **추가(append) 위주**라 시간이 지나면 stale·중복·비대가 쌓인다. 이를 정리하는 건 아래 "전체 새로고침" 책임.

## 전체 새로고침 (GC / prune) 절차 — compact 직전·누적 트리거(≥5회 또는 200줄/25KB)·사용자 요청

> 목적: 이 파일은 **회복용 핫 인덱스**(한 줄 요약 + 드릴인 포인터)이지 전체 기록이 아니다. compact가 임박하면 회복이 이 파일에 의존하므로, *없는 핵심을 채우고 stale/불필요를 도려낸다.* 모든 판정은 **기억이 아니라 접지**(Read/grep/`git log`/`ls`)로.

### 실행: 백그라운드 2-phase 위임 (discovery → GC) — 기본

검토·정리는 **메인이 인라인으로 돌리지 않는다.** 백그라운드 워크플로 `scripts/pc-review.js`에 위임한다(`Workflow({ scriptPath: "~/.claude/skills/project-context/scripts/pc-review.js", args: { projectRoot: "<프로젝트 절대경로>" } })`).

- **왜 백그라운드인가**: 검토 N라운드의 Read/grep/추론을 *서브에이전트 컨텍스트*에서 돌려 **메인 컨텍스트를 안 먹는다**. 인라인이면 컨텍스트 꽉 찬 상태에서 검토 chatter가 100% 도달→abort를 유발한다. 워커가 파일을 *디스크에서 직접 Edit*(아래 불변식)하므로 메인엔 짧은 요약(`{discovery, gc, finalize}`)만 돌아온다.
- **2-phase·각 1회 수렴·바깥 반복 없음**: ① **discovery**(누락 소진, loop-until-dry) → ② **GC**(stale prune). discovery가 raw하게 append하면 GC가 그 추가분까지 접지·중복·정합 정리한다(그래서 discovery 먼저). 둘을 *바깥 루프로 반복하지 마라* — GC가 prune한 걸 discovery가 재추가하는 진동 위험. 각각 한 번씩 수렴하면 결정적으로 끝난다.
- **모드 분리(한 run = 한 objective)**: discovery=「실제 프로젝트(git·코드·리포트)를 보고 JSON에 *없는 것*을 찾아 append」(cleanRound="새 누락 0"). GC=「JSON의 *틀린·낡은·중복*만 prune/correct」(cleanRound=아래 "stale 탐지 체크리스트" 0건). **둘을 한 루프에 섞으면 수렴이 깨진다.**
- **불변식**(sequential-review 1·2·5·6 참조): 라운드마다 *새 독립* `agentType:'general-purpose'`(저자/fork 아님) · 현재 파일 *재독* · 주장은 Read/grep/git/ls로 *접지* · 발견은 파일에 *직접 Edit*.
- **compact 직전 트리거 처리**: 백그라운드라 *이번* 압축 전 완료를 보장 못해도 괜찮다 — 파일은 증분본이라 *틀린 게 아니라 prune만 덜 된* 유효 상태고, 워커가 압축 후 끝내 파일을 고쳐 **다음 회복은 정리본으로**(자가 치유). 막판에 인라인으로 돌려 abort 내지 마라.

> 아래 8단계 + "stale 탐지 체크리스트"는 **각 phase의 점검 항목 명세**(discovery는 6단계, GC는 나머지)이자, 워크플로를 못 쓸 때의 **인라인 폴백 절차**다.

1. **전체 read + 접지 스캔.** 파일 전체를 read하고 git 상태(`git log --oneline -20`·`git status`·최근 diff)와 대조.
2. **summary·next_steps 최신화.** 첫 문단 `summary`가 *현재* 상태를 말하는가. 진행률·"진행중"·옛 active를 *현재*로 교체(이번까진 흔히 stale). recent_tasks[0]·active_tasks와 모순 없게. `next_steps`에서 이미 끝난 항목(recent_tasks와 대조) 제거·순서 재정렬 — summary의 첫 걸음과 일치하게.
3. **code_map 접지·prune.** 각 키 경로가 *실제로 존재하는가*(`ls`/`git ls-files`). 삭제·이름변경된 항목은 제거/정정. 인용한 라인번호·심볼이 옮겨졌으면 정정하거나 **변동에 약한 라인번호는 빼고 의미로 기술**(라인은 자주 stale된다). 없어진 파일에 대한 설명 금지(메모리 규칙: 인용 전 존재 확인).
4. **해결/만료 항목 제거.**
   - `open_limitations`: 이미 해결된 한계 삭제(해결 사실 접지).
   - `deferred_work`: 완료/취소된 항목 삭제(완료면 recent_tasks로 흡수됐는지 확인).
   - `key_decisions`: 번복·대체된 결정은 삭제하거나 한 줄로 `[SUPERSEDED by …]` 표기(둘 다 남겨 혼동 금지).
   - `navigation_hints`: 옛 HEAD/커밋수/diff수치 등 곧 stale될 절대값 제거(“`git log`로 확인” 식 상대표현으로). 더 이상 안 가리키는 경로 삭제.
   - `recent_tasks`: 종료 절차에서 이미 11건 회전했어야 하나 누락 대비 안전망 — 여전히 11건 이상이면 archive 회전(종료 절차 참조, 같은 스크립트). active_tasks와 중복 서술된 작업의 dedup은 아래 5번(중복 정리)에서 처리.
5. **중복·churn 정리.** 같은 사실이 여러 섹션/셀에 흩어졌으면 한 곳(정의처)만 두고 나머지는 참조 — 같은 작업이 active_tasks와 recent_tasks에 중복 서술되면 한쪽은 포인터로(“진행상태=active_tasks[0]”). 라운드별 검토로그·발견 카운트 산식 등 churn은 간결 요약으로 압축(sequential-review 불변식 7과 동일 함정).
6. **없는 핵심 보강 → 이건 discovery phase 책임(모드 분리).** 회복에 필요한데 빠진 것: 새 핵심 결정/anti_pattern, 새 코드영역 code_map, non_goals, 진행/예정(active/deferred), 재현 명령(workflows). 단 git/reports가 이미 가진 상세는 *중복하지 말고 포인터만*. **이 "누락 찾기"는 위 워크플로의 discovery phase가 *실제 프로젝트 대조*로 수행하며, loop-until-dry로 소진한다(one-shot 아님). GC phase(나머지 단계)는 이 보강을 하지 마라 — prune/correct만**(한 루프에 discovery+QA를 섞으면 수렴이 깨진다). 인라인 폴백 시에도 *먼저* 보강(discovery)을 소진한 뒤 prune으로 넘어간다.
7. **크기 예산(측정 가능·단 구조메타 예외).** 핫 인덱스로 유지(한 줄 요약·드릴인 포인터). 소프트 게이트 = **200줄/25KB**(`wc -lc`). **예산은 *비대·중복·churn·과거 history*에 적용**한다 — recent_tasks 장문·검토로그·중복 서술을 압축/포인터화. **단 `code_map`/`glossary`/`data_locations` 같은 *구조 메타*는 예외**: 파일/용어당 *한 줄*로 유지하되 프로젝트가 크면(예: 50+파일) 그만큼 커지는 게 정상이라 파일을 *지워* 예산을 맞추지 마라(사용자 목표="파일 의미·구조 메타"를 해친다). 즉 줄여야 할 건 *한 줄 초과의 장황함·중복*이지 *항목 수*가 아니다. 그래도 25KB를 크게 넘으면 상세 서술만 `meta/reports/`로 밀고 code_map은 한 줄로 압축.
8. **검증·완료판정.** JSON 유효(`python3 -c "import json,sys; json.load(open('meta/structures/project-context.json')); print('OK')"`)·`updated_at`를 현재 ISO8601로 갱신. **그 다음 아래 "stale 탐지 체크리스트"를 한 항목씩 다시 돌려 모두 0건일 때만 GC 완료**(하나라도 남으면 해당 스텝으로 돌아가 prune 반복). prune은 *되돌릴 수 있게* 커밋 단위로(직전 버전은 git에 남음).

**stale 탐지 빠른 체크리스트(= GC 완료 게이트, 전부 0건이어야 완료)**: summary가 현재 상태와 불일치(옛 "다음 한 걸음") · next_steps에 이미 끝난 항목 잔존 · 경로 없는 code_map · 해결된 limitation · 번복된 decision · 절대 커밋수/HEAD/라인번호 · "진행중"인데 끝난 작업 · active와 recent의 중복 · 같은 사실 N곳 반복.

## 새 프로젝트 도입 (init) — 절차

1. `<project>/CLAUDE.md` 생성 (없으면) — `templates/CLAUDE.md` 를 base로
2. `<project>/meta/structures/project-context.json` 생성 — `templates/project-context.json` 스키마 따름. 현재 프로젝트 상태로 채움 (LLM이 코드 read하고 작성)
3. `<project>/meta/scripts/archive-old-tasks.py` 복사 — `templates/archive-old-tasks.py` 그대로
4. **`<project>/.git/hooks/pre-commit` 설치 (의무)** — `templates/pre-commit-hook.sh` 복사 + `chmod +x`
5. **(권장) statusline 센서 설정** — "압축 전 자동 갱신"(ctx-guard 훅 #2)을 활성화한다. `~/.claude/settings.json`을 수정하므로 **사용자 승인 후** `bash templates/setup-statusline.sh` 실행(멱등·기존 statusline은 `CTX_SENSOR_INNER`로 보존·`.bak` 생성). 훅은 플러그인에 담기지만 statusline은 못 담기므로(Claude Code 제약) init이 대신 깐다. project-structure와 **공유**하므로 이미 깔렸으면 no-op. `jq`·`python3` 필요.
6. 동작 검증: `archive-old-tasks.py --dry-run`, `pre-commit` 직접 호출 후 syntax check

## 스키마 — `meta/structures/project-context.json`

```jsonc
{
  "$schema_version": 1,
  "updated_at": "ISO8601",
  "summary": "<2~4줄 현재상태 요약 — compact 후 가장 먼저 읽는 회복 핵심: 무엇을 만드는 중·지금 어디까지·바로 다음 한 걸음>",
  "next_steps": [ "<앞으로 할 일 — 순서대로 0~5개 한 줄. summary의 '다음 한 걸음' 이후 로드맵. deferred_work(보류)와 다름>" ],
  "project": { "name", "path", "purpose", "stack[]", "build_cmd", "reinstall_cmd" },
  "code_map": { "<rel-path>": "<역할 1줄>" },
  "data_locations": { "<설명>": "<path>" },
  "key_decisions": [ { "topic", "current", "lesson(짧게)", "ref_report" } ],
  "anti_patterns": [ { "do_not", "instead", "reason" } ],
  "glossary": { "<용어>": "<정의>" },
  "non_goals": [ "<의도적으로 안 하는 것 — 한 줄씩>" ],
  "open_limitations": [ "<현재 알려진 한계 — 한 줄씩>" ],
  "deferred_work": [ { "id", "title", "reason" } ],
  "recurring_risks": [ { "area", "trigger", "verify_with" } ],
  "setup_first_time": [ "<새 머신 첫 셋업 단계 — 한 줄씩>" ],
  "active_tasks": [ { "id", "title", "started_at" } ],
  "recent_tasks": [ { "id", "title", "ref_report", "completed_at" } ],
  "workflows": { "build_install_run", "log_analyze", "manual_verification", "..." },
  "user_env": { ... },
  "navigation_hints": [ "..." ],
  "archive_dir": "meta/structures/tasks-archive/"
}
```

**필드 의미 보강**:
- `summary`: **compact 후 회복의 1순위** — 컨텍스트가 압축돼도 이 2~4줄만 읽으면 "무엇을 만드는 중·지금 어디까지·바로 다음 한 걸음"을 즉시 잡는다. recent_tasks[0]·active_tasks와 모순 없게 매 종료/GC마다 최신화(가장 stale 되기 쉬운 필드). 상세는 다른 필드·reports로 드릴인하고 여기엔 포인터만.
- `next_steps`: **앞으로 할 일 로드맵** (사용자 목표 "진행해온 일·앞으로 할 일"의 후자). summary가 *한* 걸음만 담는 반면 여기엔 *순서 있는* 예정 작업 0~5개를 둔다 — compact 후 "다음에 뭐 하기로 했었나"를 회복. `deferred_work`와 구분: deferred는 *사유 있는 보류*(나중에), next_steps는 *바로 이어 할* 예정. 끝난 항목은 종료/GC마다 제거(append-only로 stale 쌓이지 않게).
- `anti_patterns`: 산재된 lesson을 응축. 새 LLM이 "하지 마라" 빠르게 학습. `do_not`/`instead`/`reason(사건 ref)` 구조.
- `key_decisions[].lesson`: 짧은 요약. 상세 사건 인용은 `anti_patterns[].reason`에 두고 중복 회피.
- `glossary`: 도메인 용어. `code_map`/`data_locations`와 중복되는 용어는 두지 마라 (한 곳에서 정의).
- `non_goals`: 의도적으로 안 하는 것 (`deferred_work`와 다름 — non_goals는 영구, deferred는 "나중에"). `anti_patterns`와 중복 X.
- `recurring_risks`: 자주 깨지는 영역. `area`(코드/기능), `trigger`(어떤 변경이 위험), `verify_with`(함께 검증할 신호/명령).
- `setup_first_time`: 새 머신/사용자 첫 셋업 (권한, 외부 도구 trust, 첫 빌드 등). 일회성이지만 명시 가치.
- `workflows.manual_verification`: 자동 테스트 없는 프로젝트의 수동 검증 절차.

> **[학습 파이프라인]과의 경계 (라우팅 충돌 회피).** 이 파일은 *이 repo의 현재상태 핫 인덱스*다. **일반화 가능한 기술 지식**(왜 이 아키텍처인가·trade-off·"실패에서 배운 일반화 원칙"·도구의 함정)은 SoT가 **wiki/pages**(`~/.claude/wiki/` 또는 `{project}/meta/wiki/`)이지 여기가 아니다 — CLAUDE.md [학습 파이프라인] 라우팅. 따라서 `key_decisions[].lesson`·`anti_patterns`·`glossary`엔 *이 프로젝트 고유의* 압축본/포인터만 두고, 가로지르는 원리는 wiki/pages에 두고 한 줄로만 참조(중복 금지·충돌 시 wiki 우선).

## pre-commit hook의 역할 (의무)

코드 / `meta/specs/` / `meta/plans/` / `meta/reports/`에 변경이 있는데 `meta/structures/project-context.json`이 같이 갱신되지 않은 채 commit 시도하면 **reject**. LLM이 5단계 5-3을 빠뜨리는 것을 차단.

bypass가 정말 필요한 경우만 `git commit --no-verify` (CLAUDE.md `[개발자 정체성] 절대 하지 않는다`의 "한 번 막혔다고 우회" 대상이라 신중).

## 갱신을 정적 스크립트로 자동화하지 마라

`lesson` 추출, 결정의 인과, deferred reason 같은 의미 영역은 LLM 판단. 정적 스크립트는 archive 회전처럼 단순 이동만.

## 운영 절차

### active_tasks 사용
- **작업 시작 시**: `active_tasks` 에 `{ id, title, started_at }` 추가. 새 세션이 진입했을 때 진행 중인 작업이 무엇인지 즉시 파악 가능.
- **작업 종료 시**: 그 entry를 제거하고 `recent_tasks` 맨 앞에 완료 entry(`completed_at` 포함)로 추가.
- **빈 배열 = 진행 중인 작업 없음**.

### read 실패 / parse 오류 fallback
- `project-context.json` 파싱 실패 시 — **자동 재생성 X**. 사용자 검토 없이 덮어쓰면 history 손실 위험.
- 대신: 사용자에게 즉시 보고 → `git log` + `meta/reports/` 로 컨텍스트 부분 회복.
- 최후 수단: `git checkout -- meta/structures/project-context.json` 으로 직전 커밋 버전 복구.

### schema_version 마이그레이션
- 현재 `$schema_version: 1`. 향후 스키마 breaking change 시 v2 번호 부여 + SKILL.md 에 마이그레이션 절차 추가.
- LLM은 read 시 `$schema_version` 확인. 모르는 버전이면 사용자에게 보고. 누락 필드는 default 또는 무시 (안전).

## 디렉토리

- 본 skill: `~/.claude/skills/project-context/`
- 템플릿: `~/.claude/skills/project-context/templates/`
- 사용처: 각 프로젝트의 `meta/structures/`, `meta/scripts/`, 프로젝트 루트, `.git/hooks/`
