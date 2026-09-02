from __future__ import annotations

from typing import Any

SUGGESTIONS: list[dict[str, Any]] = [
    {"label": "黄金 美元指数", "query": "黄金 美元指数", "asset_id": "GOLD"},
    {"label": "半导体 回调", "query": "半导体 回调", "asset_id": "SEMI"},
    {"label": "光模块 新易盛", "query": "光模块 新易盛", "asset_id": "AI"},
    {"label": "AI 应用 商业化", "query": "AI 应用 商业化", "asset_id": "AI"},
    {"label": "机器人 产业链", "query": "机器人 产业链", "asset_id": "ROBOT"},
    {"label": "白酒 景气度", "query": "白酒 景气度", "asset_id": "BAIJIU"},
    {"label": "铝 供需", "query": "铝 供需", "asset_id": "ALUMINUM"},
    {"label": "创新药 出海", "query": "创新药 出海", "asset_id": "INNOV_DRUG"},
    {"label": "科技股 估值", "query": "科技股 估值", "asset_id": "TECH"},
    {"label": "市场 风险偏好", "query": "市场 风险偏好", "asset_id": None},
]


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalise_hit(hit: Any, rank: int) -> dict[str, Any]:
    if not isinstance(hit, dict):
        return {
            "rank": rank,
            "content": str(hit or ""),
            "source": "",
            "section": None,
            "score": 0.0,
            "raw_score": 0.0,
            "type": "",
        }

    content = hit.get("content")
    source = hit.get("source")
    section = hit.get("section")
    hit_type = hit.get("type")

    score = _safe_float(hit.get("score"), 0.0)
    raw_score = _safe_float(hit.get("raw_score"), score)

    return {
        "rank": rank,
        "content": content if isinstance(content, str) else str(content or ""),
        "source": source if isinstance(source, str) else str(source or ""),
        "section": section if isinstance(section, str) else None,
        "score": score,
        "raw_score": raw_score,
        "type": hit_type if isinstance(hit_type, str) else str(hit_type or ""),
    }


def _empty_result(
    page: int,
    page_size: int,
    degraded: bool = False,
    reason: str | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "data": [],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": 0,
            "has_more": False,
        },
    }
    if degraded:
        result["degraded"] = True
    if reason:
        result["reason"] = reason
    return result


def rag_query(
    text: str,
    top_k: int = 10,
    score_threshold: float = 0.0,
    max_days: int | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    safe_page = max(1, _safe_int(page, 1))
    safe_page_size = min(100, max(1, _safe_int(page_size, 10)))
    safe_top_k = min(100, max(1, _safe_int(top_k, 10)))
    safe_threshold = min(1.0, max(0.0, _safe_float(score_threshold, 0.0)))

    safe_max_days: int | None
    if max_days is None:
        safe_max_days = None
    else:
        parsed_max_days = _safe_int(max_days, 0)
        safe_max_days = parsed_max_days if parsed_max_days > 0 else None

    query_text = text.strip() if isinstance(text, str) else ""
    if not query_text:
        return _empty_result(safe_page, safe_page_size)

    try:
        import sys

        from app.config import SCRIPTS_PATH

        scripts_path = str(SCRIPTS_PATH)
        if scripts_path not in sys.path:
            sys.path.insert(0, scripts_path)

        from query_rag import QianboshiRAG

        rag = QianboshiRAG()
        raw_hits = rag.query(
            query_text,
            top_k=safe_top_k,
            score_threshold=safe_threshold,
            max_days=safe_max_days,
        )

        if not isinstance(raw_hits, list):
            return _empty_result(safe_page, safe_page_size)

        hits = [
            _normalise_hit(hit, index)
            for index, hit in enumerate(raw_hits, start=1)
        ]

        total = len(hits)
        offset = (safe_page - 1) * safe_page_size
        page_data = hits[offset : offset + safe_page_size]

        return {
            "data": page_data,
            "pagination": {
                "page": safe_page,
                "page_size": safe_page_size,
                "total": total,
                "has_more": offset + len(page_data) < total,
            },
        }
    except Exception as error:
        error_text = str(error).casefold()
        chroma_related = any(
            marker in error_text
            for marker in (
                "chroma",
                "chromadb",
                "collection",
                "embedding",
                "vector",
            )
        )

        return _empty_result(
            safe_page,
            safe_page_size,
            degraded=True,
            reason=(
                "chromadb unavailable"
                if chroma_related
                else "rag query unavailable"
            ),
        )


def rag_suggestions() -> list[dict]:
    return [dict(item) for item in SUGGESTIONS]