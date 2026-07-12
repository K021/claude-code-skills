#!/usr/bin/env bash
# Isolated plugin-install smoke test for this Claude Code plugin marketplace.
#
# Spins up a throwaway CLAUDE_CONFIG_DIR so nothing touches your real ~/.claude
# (your originals in ~/.claude/skills/ are left untouched), adds this repo as a
# marketplace, installs every plugin it declares, and verifies files landed.
#
# Usage:
#   ./test-install.sh                    # test the LOCAL working tree (default — pre-push)
#   ./test-install.sh K021/agent-harness # test a published GitHub repo
#   ./test-install.sh /path/to/repo      # test any local path
#
# Plugin list is read from .claude-plugin/marketplace.json, so new plugins are
# picked up automatically (no need to edit this script).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${1:-$REPO_ROOT}"
MKT_JSON="$REPO_ROOT/.claude-plugin/marketplace.json"

command -v claude  >/dev/null || { echo "❌ 'claude' CLI not found"; exit 1; }
command -v python3 >/dev/null || { echo "❌ python3 not found";      exit 1; }
[ -f "$MKT_JSON" ] || { echo "❌ marketplace.json not found: $MKT_JSON"; exit 1; }

MKT_NAME="$(python3 -c "import json;print(json.load(open('$MKT_JSON'))['name'])")"
PLUGINS="$(python3 -c "import json;print(' '.join(p['name'] for p in json.load(open('$MKT_JSON'))['plugins']))")"

# Throwaway config dir — always removed, even on failure.
CFG="$(mktemp -d "${TMPDIR:-/tmp}/ah-test.XXXXXX")"
trap 'rm -rf "$CFG"' EXIT
export CLAUDE_CONFIG_DIR="$CFG"

echo "▶ source     : $SOURCE"
echo "▶ marketplace: $MKT_NAME"
echo "▶ plugins    : $PLUGINS"
echo "▶ config dir : $CFG (isolated, auto-removed)"
echo

# From here on, don't abort on a single failing step — always reach the summary.
set +e
fail=0

echo "== add marketplace =="
claude plugin marketplace add "$SOURCE" 2>&1 | tail -3
claude plugin marketplace list 2>&1 | grep -q "$MKT_NAME" || { echo "  ❌ marketplace '$MKT_NAME' not registered"; fail=1; }

echo; echo "== install plugins =="
for p in $PLUGINS; do
  claude plugin install "$p@$MKT_NAME" 2>&1 | tail -1
done

echo; echo "== verify =="
list="$(claude plugin list 2>&1)"
for p in $PLUGINS; do
  if ! printf '%s' "$list" | grep -q "$p@$MKT_NAME"; then
    echo "  ❌ $p — not in plugin list"; fail=1; continue
  fi
  if find "$CFG/plugins/cache/$MKT_NAME/$p" -name SKILL.md 2>/dev/null | grep -q .; then
    echo "  ✅ $p — installed + SKILL.md present"
  else
    echo "  ⚠ $p — installed but SKILL.md missing"; fail=1
  fi
done

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ PASS — 배포 경로 정상 (marketplace: $MKT_NAME)"
else
  echo "❌ FAIL — 위 항목 확인"
fi
exit "$fail"
