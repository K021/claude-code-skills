# Isolated plugin-install smoke test for this Claude Code marketplace.
# Runs in a throwaway CLAUDE_CONFIG_DIR — never touches your real ~/.claude.
.PHONY: help test test-remote

REMOTE ?= K021/agent-harness

help:
	@echo "make test         # 로컬 작업트리를 격리 환경에서 설치 테스트 (push 전 검증)"
	@echo "make test-remote  # published GitHub repo ($(REMOTE)) 설치 테스트"

test:
	@./test-install.sh

test-remote:
	@./test-install.sh $(REMOTE)
