from __future__ import annotations

import json
import sqlite3
import sys
from collections import Counter
from typing import Any

from app.repositories.schema_registry import DATABASE_PATH, DATA_ROOT

STRUCTURED_VIEWS_PATH = DATA_ROOT / "views" / "structured_views.jsonl"
SCRIPTS_PATH = r"E:\qianboshi-agent\scripts"

ASSET_ALIASES: dict[str, tuple[str, ...]] = {
    "GOLD": ("GOLD", "黄金", "贵金属", "黄金ETF", "518880.SS"),
    "SEMI": (
        "SEMI",
        "半导体",
        "芯片",
        "集成电路",
        "159813.SZ",
        "512480.SS",
    ),
    "AI": (
        "AI",
        "人工智能",
        "AI应用",
        "算力",
        "光模块",
        "中际旭创",
        "新易盛",
        "300308.SZ",
        "300502.SZ",
    ),
    "ROBOT": ("ROBOT", "机器人", "机器人产业链", "人形机器人"),
    "BAIJIU": ("BAIJIU", "白酒", "消费", "白酒ETF", "512690.SS"),
    "ALUMINUM": ("ALUMINUM", "铝", "铝业", "有色金属", "601600.SS"),
    "INNOV_DRUG": (
        "INNOV_DRUG",
        "创新药",
        "医药",
        "CXO",
        "创新药ETF",
        "159992.SZ",
    ),
    "TECH": ("TECH", "科技", "科技成长", "成长股"),
}


def _database_uri() -> str:
    return f"file:{DATABASE_PATH.as_posix()}?mode=ro"


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _json_value(value: Any) -> Any:
    if isinstance(value, (dict, list, tuple)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return value
    return value


def _row_to_dict(cursor: sqlite3.Cursor, row: tuple[Any, ...]) -> dict[str, Any]:
    return {
        str(description[0]): value
        for description, value in zip(cursor.description or (), row)
    }


def _table_columns(connection: sqlite3.Connection, table_name: str) -> set[str]:
    try:
        rows = connection.execute(
            f"PRAGMA table_info({table_name})"
        ).fetchall()
        return {str(row[1]) for row in rows if len(row) > 1}
    except sqlite3.Error:
        return set()


def _read_asset_cards() -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            cursor = connection.execute("SELECT * FROM asset_cards")
            return [_row_to_dict(cursor, row) for row in cursor.fetchall()]
    except (sqlite3.Error, OSError):
        return []


def _read_factor_states(asset_id: str | None = None) -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            columns = _table_columns(connection, "factor_states")
            if not columns:
                return []

            if asset_id is not None and "asset_id" in columns:
                cursor = connection.execute(
                    "SELECT * FROM factor_states WHERE asset_id = ?",
                    (asset_id,),
                )
            else:
                cursor = connection.execute("SELECT * FROM factor_states")

            return [_row_to_dict(cursor, row) for row in cursor.fetchall()]
    except (sqlite3.Error, OSError):
        return []


def _normalised_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.casefold()
    if isinstance(value, (list, tuple, set)):
        return " ".join(_normalised_text(item) for item in value)
    if isinstance(value, dict):
        return " ".join(
            f"{_normalised_text(key)} {_normalised_text(item)}"
            for key, item in value.items()
        )
    return str(value).casefold()


def _entity_text(record: dict[str, Any]) -> str:
    entities = record.get("entities")
    return " ".join(
        (
            _normalised_text(entities),
            _normalised_text(record.get("claim")),
            _normalised_text(record.get("evidence")),
            _normalised_text(record.get("logic")),
            _normalised_text(record.get("section")),
        )
    )


def _asset_matches(record: dict[str, Any], asset_id: str) -> bool:
    aliases = ASSET_ALIASES.get(asset_id.upper(), (asset_id,))
    haystack = _entity_text(record)
    return any(alias.casefold() in haystack for alias in aliases if alias)


def _iter_structured_views() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    try:
        with STRUCTURED_VIEWS_PATH.open(encoding="utf-8-sig") as file:
            for line in file:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(record, dict):
                    records.append(record)
    except (OSError, UnicodeError):
        return []

    return records


def _view_summary(asset_id: str) -> dict[str, Any]:
    stance_counts: Counter[str] = Counter()
    matching_count = 0

    for record in _iter_structured_views():
        if not _asset_matches(record, asset_id):
            continue
        matching_count += 1
        stance = record.get("stance")
        if isinstance(stance, str) and stance.strip():
            stance_counts[stance.strip()] += 1

    return {
        "views_count": matching_count,
        "stance_counts": dict(stance_counts),
        "bullish_count": stance_counts.get("bullish", 0),
        "bearish_count": stance_counts.get("bearish", 0),
        "neutral_count": stance_counts.get("neutral", 0),
    }


def _factor_summary(asset_id: str) -> dict[str, Any]:
    factors = _read_factor_states(asset_id)
    impact_counts: Counter[str] = Counter()

    for factor in factors:
        direction = factor.get("impact_direction")
        if isinstance(direction, str) and direction.strip():
            impact_counts[direction.strip()] += 1

    return {
        "factor_count": len(factors),
        "impact_direction_counts": dict(impact_counts),
        "factors": factors[:3],
    }


def _asset_item(card: dict[str, Any]) -> dict[str, Any]:
    asset_id = str(card.get("asset_id") or "").strip()
    view_summary = _view_summary(asset_id)
    factor_summary = _factor_summary(asset_id)

    return {
        "asset_id": asset_id,
        "asset_name": card.get("asset_name"),
        "asset_type": card.get("asset_type"),
        "description": card.get("description"),
        "version": card.get("version"),
        "default_horizon": card.get("default_horizon"),
        "updated_at": card.get("updated_at"),
        "factor_count": factor_summary["factor_count"],
        "factor_preview": factor_summary["factors"],
        "views_count": view_summary["views_count"],
        "stance_counts": view_summary["stance_counts"],
        "bullish_count": view_summary["bullish_count"],
        "bearish_count": view_summary["bearish_count"],
        "neutral_count": view_summary["neutral_count"],
    }


def get_assets_index() -> dict:
    assets = [_asset_item(card) for card in _read_asset_cards()]
    assets.sort(key=lambda item: str(item.get("asset_id") or ""))

    return {
        "data": assets,
        "total": len(assets),
    }


def get_asset_evidence_pack(
    asset_id: str,
    horizon: str = "medium",
) -> dict:
    safe_asset_id = str(asset_id or "").strip().upper()
    safe_horizon = str(horizon or "medium").strip().lower() or "medium"

    if not safe_asset_id:
        return {"error": "asset_id is required"}

    try:
        if SCRIPTS_PATH not in sys.path:
            sys.path.insert(0, SCRIPTS_PATH)

        from evidence_pack_builder import build_evidence_pack

        result = build_evidence_pack(safe_asset_id, safe_horizon)
        if isinstance(result, dict):
            return result
        return {"error": "evidence pack returned an invalid structure"}
    except Exception as error:
        return {
            "error": str(error),
            "asset_id": safe_asset_id,
            "horizon": safe_horizon,
        }


def _view_item(record: dict[str, Any]) -> dict[str, Any]:
    entities = record.get("entities")
    if not isinstance(entities, dict):
        entities = {}

    return {
        "view_id": str(record.get("view_id") or ""),
        "analyst": str(record.get("analyst") or ""),
        "claim": str(record.get("claim") or ""),
        "confidence": _safe_float(record.get("confidence")),
        "date": record.get("date") if isinstance(record.get("date"), str) else None,
        "entities": entities,
        "evidence": record.get("evidence"),
        "horizon": str(record.get("horizon") or ""),
        "logic": record.get("logic"),
        "quality_flags": record.get("quality_flags"),
        "risk": record.get("risk"),
        "section": record.get("section"),
        "source_bv": record.get("source_bv"),
        "source_file": record.get("source_file"),
        "source_type": record.get("source_type"),
        "stance": str(record.get("stance") or ""),
        "timestamp": record.get("timestamp"),
        "version": record.get("version"),
        "view_type": record.get("view_type"),
    }


def get_asset_views(
    asset_id: str,
    page: int,
    page_size: int,
) -> dict:
    safe_page = max(1, _safe_int(page, 1))
    safe_page_size = min(100, max(1, _safe_int(page_size, 20)))
    safe_asset_id = str(asset_id or "").strip().upper()

    matched = [
        _view_item(record)
        for record in _iter_structured_views()
        if _asset_matches(record, safe_asset_id)
    ]
    matched.sort(
        key=lambda item: (
            item.get("date") is not None,
            str(item.get("date") or ""),
            str(item.get("view_id") or ""),
        ),
        reverse=True,
    )

    total = len(matched)
    offset = (safe_page - 1) * safe_page_size
    data = matched[offset : offset + safe_page_size]

    return {
        "data": data,
        "pagination": {
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total,
            "has_more": offset + len(data) < total,
        },
    }