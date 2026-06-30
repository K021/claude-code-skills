#!/bin/bash
# project-context skill pre-commit hook
# 코드/specs/plans/reports에 변경이 있는데 meta/structures/project-context.json이
# 같이 갱신되지 않으면 commit reject. LLM이 5단계 5-3 갱신을 빠뜨리는 것을 차단.
#
# 설치: cp <skill-templates>/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
# bypass (신중): git commit --no-verify

set -e

CONTEXT_FILE="meta/structures/project-context.json"

# project-context.json이 없는 프로젝트 — 패턴 미사용. 통과.
if [ ! -f "$CONTEXT_FILE" ]; then
    exit 0
fi

# 의미 있는 변경 (코드/문서) 이 staged 됐나
CHANGED_TRACKED=$(git diff --cached --name-only --diff-filter=ACMRT \
    -- 'meta/specs/' 'meta/plans/' 'meta/reports/' \
    | grep -v '^meta/structures/' || true)

# 코드 디렉토리는 프로젝트마다 다름 — 메타 디렉토리 외 모든 것을 코드로 간주
CHANGED_CODE=$(git diff --cached --name-only --diff-filter=ACMRT \
    | grep -vE '^meta/' \
    | grep -vE '^\.git' || true)

CHANGED_MEANINGFUL="$CHANGED_TRACKED$CHANGED_CODE"

if [ -z "$CHANGED_MEANINGFUL" ]; then
    exit 0  # 메타 자체 변경만 — 통과
fi

# context.json 같이 갱신됐나
CHANGED_CTX=$(git diff --cached --name-only --diff-filter=ACMRT -- "$CONTEXT_FILE" || true)

if [ -z "$CHANGED_CTX" ]; then
    cat >&2 <<EOF
ERROR: 코드/specs/plans/reports 변경됐는데 $CONTEXT_FILE 갱신 안 됨.

5단계 5-3에 따라 다음을 갱신:
  - recent_tasks (맨 앞에 새 작업)
  - key_decisions / open_limitations / deferred_work (해당 시)
  - code_map (코드 파일 추가/제거 시)
  - updated_at
  - recent_tasks > 10이면 archive 회전

상세: ~/.claude/skills/project-context/SKILL.md

변경된 파일들:
$(echo "$CHANGED_MEANINGFUL" | sed 's/^/  /')

bypass (정말 필요한 경우만): git commit --no-verify
EOF
    exit 1
fi

exit 0
