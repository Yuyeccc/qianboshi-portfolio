# -*- coding: utf-8 -*-
"""生成静态快照 JSON（供 GitHub Pages / SnapshotClient 使用）。

用法:
    C:/Python314/python.exe backend/scripts/generate_snapshots.py

输出:
    frontend/public/snapshots/*.json
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.repositories.architecture_repo import get_architecture_data  # noqa: E402
from app.repositories.asset_vault_repo import (  # noqa: E402
    get_asset_evidence_pack,
    get_assets_index,
)
from app.repositories.assets_repo import get_assets_data  # noqa: E402
from app.repositories.brief_repo import get_brief, list_briefs  # noqa: E402
from app.repositories.cognitive_repo import (  # noqa: E402
    get_cognitive_data,
    get_dimensions_page,
)
from app.repositories.decisions_repo import get_decisions_data  # noqa: E402
from app.repositories.discipline_repo import get_discipline_data  # noqa: E402
from app.repositories.market_repo import get_market_data  # noqa: E402
from app.repositories.overview_repo import (  # noqa: E402
    get_latest_brief,
    get_overview_metrics,
    get_system_status,
)
from app.repositories.rag_vault_repo import rag_query, rag_suggestions  # noqa: E402
from app.repositories.vault_repo import (  # noqa: E402
    get_note_detail,
    get_vault_summary,
    list_notes,
)

OUT_DIR = BACKEND_ROOT.parent / "frontend" / "public" / "snapshots"

ASSET_IDS = (
    "GOLD",
    "SEMI",
    "AI",
    "ROBOT",
    "BAIJIU",
    "ALUMINUM",
    "INNOV_DRUG",
    "TECH",
)

RAG_PRESETS = (
    {
        "id": "gold-dollar",
        "label": "黄金 美元指数",
        "query": "黄金 美元指数",
    },
    {
        "id": "semiconductor-pullback",
        "label": "半导体 回调",
        "query": "半导体 回调",
    },
    {
        "id": "optical-module",
        "label": "光模块 新易盛",
        "query": "光模块 新易盛",
    },
    {
        "id": "ai-commercialization",
        "label": "AI 应用 商业化",
        "query": "AI 应用 商业化",
    },
    {
        "id": "robotics",
        "label": "机器人 产业链",
        "query": "机器人 产业链",
    },
    {
        "id": "aluminum",
        "label": "铝 供需",
        "query": "铝 供需",
    },
    {
        "id": "innovative-drugs",
        "label": "创新药 出海",
        "query": "创新药 出海",
    },
    {
        "id": "baijiu",
        "label": "白酒 复苏",
        "query": "白酒 复苏",
    },
)


def _generated_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def dump(name: str, payload: Any) -> int:
    """写入快照并返回文件大小。"""
    path = OUT_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        json.dumps(
            payload,
            ensure_ascii=False,
            indent=2,
            default=str,
        ).encode("utf-8")
    )
    size = path.stat().st_size
    print(f"  {name} ({size} 字节)")
    return size


def _safe_call(function: Any, fallback: Any, *args: Any, **kwargs: Any) -> Any:
    try:
        return function(*args, **kwargs)
    except Exception as exc:
        print(f"  [WARN] {getattr(function, '__name__', function)}: {exc}")
        return fallback


def _note_index_payload() -> dict:
    result = _safe_call(
        list_notes,
        {
            "data": [],
            "pagination": {
                "page": 1,
                "page_size": 0,
                "total": 0,
                "has_more": False,
            },
        },
        page=1,
        page_size=100000,
        query=None,
        date_from=None,
        date_to=None,
        tags=None,
        source=None,
        sort="date_desc",
    )
    result["pagination"] = {
        **result.get("pagination", {}),
        "page": 1,
        "page_size": len(result.get("data", [])),
        "total": len(result.get("data", [])),
        "has_more": False,
    }
    return {"notes_data": result}


def _asset_ids(asset_index: dict) -> list[str]:
    """从资产索引读取资产 ID，使用已知资产集合作为完整性兜底。"""
    ids: list[str] = []
    candidates = asset_index.get("assets", asset_index.get("data", []))

    if isinstance(candidates, dict):
        candidates = list(candidates.values())

    if isinstance(candidates, list):
        for item in candidates:
            if isinstance(item, dict):
                asset_id = item.get("asset_id") or item.get("assetId")
                if asset_id:
                    ids.append(str(asset_id).upper())
            elif isinstance(item, str):
                ids.append(item.upper())

    for asset_id in ASSET_IDS:
        if asset_id not in ids:
            ids.append(asset_id)
    return ids


def _write_phase3_snapshots() -> dict:
    """生成研究档案库的全部分片，并返回 manifest 统计信息。"""
    generated_at = _generated_at()
    counts = {
        "notes": 0,
        "note_details": 0,
        "assets": 0,
        "evidence_packs": 0,
        "rag_presets": 0,
    }
    total_bytes = 0

    vault_summary = _safe_call(
        get_vault_summary,
        {
            "meta": {
                "generated_at": generated_at,
                "source": "snapshot",
            },
            "notes_count": 0,
            "views_count": 0,
            "chunks_count": 0,
            "assets_count": 0,
            "latest_note_date": None,
            "modes": ["notes", "search", "assets"],
        },
    )
    total_bytes += dump("vault-summary.json", {"vault_summary": vault_summary})

    notes_payload = _note_index_payload()
    note_items = notes_payload["notes_data"].get("data", [])
    counts["notes"] = len(note_items)
    total_bytes += dump("notes-index.json", notes_payload)

    for item in note_items:
        note_id = item.get("note_id") or item.get("noteId")
        if not note_id:
            continue

        detail = _safe_call(get_note_detail, None, str(note_id))
        if detail is None:
            continue

        counts["note_details"] += 1
        total_bytes += dump(f"notes/{note_id}.json", {"note": detail})

    assets_index = _safe_call(get_assets_index, {"assets": []})
    total_bytes += dump("assets-index.json", {"assets_index": assets_index})

    asset_ids = _asset_ids(assets_index)
    counts["assets"] = len(asset_ids)

    for asset_id in asset_ids:
        for horizon in ("medium", "short", "long"):
            evidence_pack = _safe_call(
                get_asset_evidence_pack,
                {"error": "evidence pack unavailable"},
                asset_id,
                horizon,
            )
            counts["evidence_packs"] += 1
            total_bytes += dump(
                f"assets/{asset_id}/evidence-pack-{horizon}.json",
                {"evidence_pack": evidence_pack},
            )

    suggestions = _safe_call(rag_suggestions, [])
    total_bytes += dump("rag/suggestions.json", {"suggestions": suggestions})

    preset_ids: list[str] = []
    for preset in RAG_PRESETS:
        preset_ids.append(preset["id"])
        rag_data = _safe_call(
            rag_query,
            {
                "data": [],
                "pagination": {
                    "page": 1,
                    "page_size": 10,
                    "total": 0,
                    "has_more": False,
                },
            },
            text=preset["query"],
            top_k=10,
            score_threshold=0.0,
            max_days=None,
            page=1,
            page_size=10,
        )
        counts["rag_presets"] += 1
        total_bytes += dump(
            f"rag/presets/{preset['id']}.json",
            {
                "preset_id": preset["id"],
                "label": preset["label"],
                "query": preset["query"],
                "rag_data": rag_data,
            },
        )

    manifest = {
        "generated_at": generated_at,
        "counts": counts,
        "modes": ["notes", "search", "assets"],
        "note_count": counts["notes"],
        "preset_ids": preset_ids,
        "total_bytes": total_bytes,
    }
    dump("manifest.json", manifest)
    return manifest


def main() -> None:
    print("生成快照 →", OUT_DIR)

    # 1. overview.json（首页）
    dump(
        "overview.json",
        {
            "metrics": get_overview_metrics(),
            "status": get_system_status(),
            "latest_brief": get_latest_brief(),
        },
    )

    # 2. architecture.json
    dump("architecture.json", {"architecture_data": get_architecture_data()})

    # 3. data-assets.json
    dump("data-assets.json", {"assets": get_assets_data()})

    # 3.5 cognitive.json（认知内核，含维度明细首屏快照供下钻 preview 模式使用）
    cognitive_data = get_cognitive_data()
    cognitive_data["dimensions_page"] = get_dimensions_page(page=1, page_size=20)
    dump("cognitive.json", {"cognitive_data": cognitive_data})

    # 4. decision-desk.json
    dump("decision-desk.json", {"decisions_data": get_decisions_data()})

    # 5. discipline.json
    dump("discipline.json", {"discipline_data": get_discipline_data()})

    # 6. market.json
    dump("market.json", {"market_data": get_market_data()})

    # 7. about.json（后端暂无 about_repo，占位空结构）
    dump(
        "about.json",
        {
            "meta": {
                "status": "ready",
                "updated_at": _generated_at(),
                "source": "snapshot",
            },
            "profile": None,
        },
    )

    # 8. briefs.json（列表 + 每篇全文内嵌，供 SnapshotClient.getBrief 按 filename 查找）
    brief_items = list_briefs()
    briefs_full = []
    for item in brief_items:
        detail = get_brief(item["filename"])
        if detail:
            briefs_full.append({**item, "content": detail["content"]})
    dump("briefs.json", {"briefs": briefs_full})

    manifest = _write_phase3_snapshots()

    print(
        "\n快照生成完成："
        f"基础快照 8 个，笔记索引 {manifest['counts']['notes']} 条，"
        f"笔记详情 {manifest['counts']['note_details']} 篇，"
        f"资产 {manifest['counts']['assets']} 张，"
        f"RAG 预设 {manifest['counts']['rag_presets']} 个。"
    )


if __name__ == "__main__":
    main()