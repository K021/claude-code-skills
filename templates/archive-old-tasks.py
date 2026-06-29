#!/usr/bin/env python3
"""project-context.json의 recent_tasks 회전.

recent_tasks 가 KEEP 개수를 초과하면 oldest 항목들을
meta/structures/tasks-archive/<YYMM>.json 에 이동.

사용:
  python3 meta/scripts/archive-old-tasks.py [--dry-run]

이 스크립트는 정적 회전만 — 의미 추출/요약은 LLM(현재 세션) 책임.
"""
import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

KEEP = 10
ROOT = Path(__file__).resolve().parents[2]  # meta/scripts → project root
CONTEXT = ROOT / "meta/structures/project-context.json"
ARCHIVE_DIR = ROOT / "meta/structures/tasks-archive"


def load_context():
    if not CONTEXT.exists():
        print(f"ERROR: {CONTEXT} 없음", file=sys.stderr)
        sys.exit(1)
    with open(CONTEXT) as f:
        return json.load(f)


def parse_yymm(completed_at: str) -> str:
    """'2026-05-10' → '202605'"""
    try:
        dt = datetime.fromisoformat(completed_at)
        return dt.strftime("%Y%m")
    except ValueError:
        return "unknown"


def archive_oldest(ctx, dry_run: bool):
    tasks = ctx.get("recent_tasks", [])
    if len(tasks) <= KEEP:
        print(f"recent_tasks: {len(tasks)} <= {KEEP} — 회전 불필요")
        return False

    # recent_tasks는 최신이 앞 (LLM이 그렇게 갱신). oldest는 끝에서.
    keep = tasks[:KEEP]
    archived = tasks[KEEP:]

    # YYMM 별로 그룹화
    by_yymm = defaultdict(list)
    for t in archived:
        yymm = parse_yymm(t.get("completed_at", ""))
        by_yymm[yymm].append(t)

    if dry_run:
        print("--dry-run: 다음 작업이 회전 대상")
        for t in archived:
            print(f"  → {t.get('id')}: {t.get('title','')[:60]}")
        return False

    # 각 YYMM 파일에 append (기존 파일 있으면 합침)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    for yymm, items in by_yymm.items():
        path = ARCHIVE_DIR / f"{yymm}.json"
        if path.exists():
            with open(path) as f:
                existing = json.load(f)
        else:
            existing = []
        existing.extend(items)
        # id 중복 제거 (id 같으면 새 것 우선)
        seen_ids = {}
        for t in existing:
            tid = t.get("id")
            if tid:
                seen_ids[tid] = t
        merged = list(seen_ids.values())
        # 같은 YYMM 안에서는 completed_at 내림차순
        merged.sort(key=lambda t: t.get("completed_at", ""), reverse=True)
        with open(path, "w") as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
        print(f"archived → {path} ({len(items)}건 추가, 총 {len(merged)}건)")

    # context 갱신
    ctx["recent_tasks"] = keep
    ctx["updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    with open(CONTEXT, "w") as f:
        json.dump(ctx, f, ensure_ascii=False, indent=2)
    print(f"recent_tasks: {len(tasks)} → {KEEP} (archive {len(archived)}건)")
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    ctx = load_context()
    archive_oldest(ctx, args.dry_run)


if __name__ == "__main__":
    main()
