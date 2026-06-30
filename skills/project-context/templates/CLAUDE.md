# <PROJECT_NAME> 프로젝트 — Claude Code 진입 가이드

> 이 파일은 새 세션이 이 프로젝트에 들어왔을 때 자동 로드되는 진입점.
> 프로젝트 컨텍스트(코드 구조 / 작업 현황 / 결정 / 한계 / 워크플로) 는 다음 파일을 먼저 읽어라:
>
> **`meta/structures/project-context.json`**
>
> 그 후 필요한 상세 정보는 거기서 가리키는 `meta/specs|plans|reports/` 로 drill-in.
>
> 패턴 상세: `~/.claude/skills/project-context/SKILL.md`

---

## 작업 종료 시 책임 ([문제 해결 방법] 5단계 5-3 보강)

`meta/structures/project-context.json` 갱신 (현재 세션 LLM 책임 — 정적 자동 X):
- `recent_tasks` 맨 앞에 새 작업 추가 (id / title / ref_report / completed_at)
- 새 결정/한계/보류 → `key_decisions` / `open_limitations` / `deferred_work` 갱신
- 코드 파일 추가/제거 시 `code_map` 갱신
- `updated_at` 갱신
- `recent_tasks`가 11건 이상이면 `meta/scripts/archive-old-tasks.py` 실행

## 갱신 누락 차단

`.git/hooks/pre-commit` 이 코드/specs/plans/reports 변경 시 `project-context.json` 미갱신을 reject. bypass는 신중 (`--no-verify`).
