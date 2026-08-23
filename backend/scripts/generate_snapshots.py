# -*- coding: utf-8 -*-
"""Phase 5: 生成静态快照 JSON（供 GitHub Pages / SnapshotClient 使用）

用法: C:/Python314/python.exe backend/scripts/generate_snapshots.py
输出: frontend/public/snapshots/*.json（8 个）
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.repositories.architecture_repo import get_architecture_data  # noqa: E402
from app.repositories.assets_repo import get_assets_data  # noqa: E402
from app.repositories.brief_repo import get_brief, list_briefs  # noqa: E402
from app.repositories.decisions_repo import get_decisions_data  # noqa: E402
from app.repositories.discipline_repo import get_discipline_data  # noqa: E402
from app.repositories.market_repo import get_market_data  # noqa: E402
from app.repositories.overview_repo import (  # noqa: E402
    get_latest_brief,
    get_overview_metrics,
    get_system_status,
)

OUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "snapshots"


def dump(name: str, payload: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_bytes(
        json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    )
    print(f"  ✅ {name} ({path.stat().st_size} 字节)")


def main() -> None:
    print("生成快照 →", OUT_DIR)

    # 1. overview.json（首页）
    dump("overview.json", {
        "metrics": get_overview_metrics(),
        "status": get_system_status(),
        "latest_brief": get_latest_brief(),
    })

    # 2. architecture.json
    dump("architecture.json", {"architecture_data": get_architecture_data()})

    # 3. data-assets.json
    dump("data-assets.json", {"assets": get_assets_data()})

    # 4. decision-desk.json
    dump("decision-desk.json", {"decisions_data": get_decisions_data()})

    # 5. discipline.json
    dump("discipline.json", {"discipline_data": get_discipline_data()})

    # 6. market.json
    dump("market.json", {"market_data": get_market_data()})

    # 7. about.json（后端暂无 about_repo，占位空结构）
    dump("about.json", {
        "meta": {
            "status": "ready",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "source": "snapshot",
        },
        "profile": None,
    })

    # 8. briefs.json（列表 + 每篇全文内嵌，供 SnapshotClient.getBrief 按 filename 查找）
    brief_items = list_briefs()
    briefs_full = []
    for item in brief_items:
        detail = get_brief(item["filename"])
        if detail:
            briefs_full.append({**item, "content": detail["content"]})
    dump("briefs.json", {"briefs": briefs_full})

    print(f"\n共 8 个快照文件，简报 {len(briefs_full)} 篇。")


if __name__ == "__main__":
    main()
