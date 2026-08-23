from __future__ import annotations

import re
import sqlite3
from datetime import datetime, timezone
from typing import Any

from app.repositories.overview_repo import DATABASE_PATH


HORIZON_LABELS = {
    "short": "短期",
    "medium": "中期",
    "long": "长期",
}

PRINCIPLES = [
    {
        "id": "p1",
        "title": "观点必须有来源",
        "description": "每条观点记录分析师/来源/日期",
    },
    {
        "id": "p2",
        "title": "预测必须有时间窗口",
        "description": "每个判断挂 maturity，到期自动复盘",
    },
    {
        "id": "p3",
        "title": "到期后必须记录结果",
        "description": "复盘回填收益并判定 hit/wrong",
    },
]

FRAMEWORK = [
    {
        "rule_id": "r1",
        "title": "情绪定方向",
        "description": "恐慌贪婪定多空，不追涨杀跌",
        "status": "active",
    },
    {
        "rule_id": "r2",
        "title": "纪律定仓位",
        "description": "按档位计划分批建仓，仓位不由感觉决定",
        "status": "active",
    },
    {
        "rule_id": "r3",
        "title": "止损定退出",
        "description": "预设失效条件，触达即退出",
        "status": "active",
    },
    {
        "rule_id": "r4",
        "title": "到期必复盘",
        "description": "判断挂时间窗口，到期自动复盘",
        "status": "active",
    },
]

SENSITIVE_TERMS = (
    "持仓",
    "成本",
    "000217",
    "159992",
    "买入价",
    "卖出价",
    "市值",
    "盈亏",
    "投钱",
)

SENSITIVE_PATTERN = re.compile(
    r"(?:持仓\d|成本\d|000217|159992|\d+(?:\.\d+)?\s*元|买入价|卖出价|市值|盈亏|投钱|加仓)"
)


def _database_uri() -> str:
    return f"file:{DATABASE_PATH.as_posix()}?mode=ro"


def _text(value: Any, default: str = "") -> str:
    return value.strip() if isinstance(value, str) else default


def _nullable_text(value: Any) -> str | None:
    text = _text(value)
    return text or None


def _safe_float(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _sanitized_text(value: Any, limit: int = 100) -> str:
    text = _text(value)
    match = SENSITIVE_PATTERN.search(text)
    if match:
        text = text[: match.start()]
    return text[:limit].strip(" ，,；;。.!！？")


def _sanitized_reasons(value: Any) -> list[str]:
    if isinstance(value, (list, tuple)):
        values = value
    elif isinstance(value, str):
        values = re.split(r"[\n|；;]", value)
    else:
        values = []

    reasons: list[str] = []
    for item in values[:3]:
        cleaned = _sanitized_text(item, limit=100)
        if cleaned:
            reasons.append(cleaned)
    return reasons


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    try:
        rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
        return {_text(row[1]) for row in rows}
    except Exception:
        return set()


def _select_expression(columns: set[str], name: str, fallback: str = "NULL") -> str:
    return name if name in columns else fallback


def _get_logs(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    columns = _table_columns(connection, "user_decision_logs")
    if not columns:
        return []

    selected = [
        _select_expression(columns, "decision_id", "''"),
        _select_expression(columns, "decision_date"),
        _select_expression(columns, "asset_name", "''"),
        _select_expression(columns, "direction", "''"),
        _select_expression(columns, "horizon", "''"),
        _select_expression(columns, "conviction"),
        _select_expression(columns, "thesis", "''"),
        _select_expression(columns, "key_reasons", "NULL"),
        _select_expression(columns, "status", "''"),
    ]

    order_column = "decision_date" if "decision_date" in columns else "rowid"
    rows = connection.execute(
        f"""
        SELECT {", ".join(selected)}
        FROM user_decision_logs
        ORDER BY {order_column} DESC, rowid DESC
        """
    ).fetchall()

    logs: list[dict[str, Any]] = []
    for row in rows:
        raw_reasons = row[7]
        if isinstance(raw_reasons, str):
            try:
                import json

                raw_reasons = json.loads(raw_reasons)
            except (TypeError, ValueError):
                pass

        logs.append(
            {
                "decision_id": _text(row[0]),
                "date": row[1] if isinstance(row[1], str) else None,
                "asset_name": _text(row[2]),
                "direction": _text(row[3]),
                "horizon": _text(row[4]),
                "conviction": _safe_float(row[5]),
                "thesis": _sanitized_text(row[6]),
                "key_reasons": _sanitized_reasons(raw_reasons),
                "status": _text(row[8]),
                "review": None,
            }
        )
    return logs


def _get_reviews(
    connection: sqlite3.Connection,
) -> dict[str, dict[str, Any]]:
    review_columns = _table_columns(connection, "decision_reviews")
    if not review_columns or "decision_id" not in review_columns:
        return {}

    selected = [
        "reviews.decision_id",
        _select_expression(review_columns, "review_date"),
        _select_expression(review_columns, "result_label", "''"),
        _select_expression(review_columns, "outcome_return"),
        _select_expression(review_columns, "horizon_days"),
    ]
    rows = connection.execute(
        f"""
        SELECT {", ".join(selected)}
        FROM decision_reviews AS reviews
        ORDER BY reviews.rowid DESC
        """
    ).fetchall()

    reviews: dict[str, dict[str, Any]] = {}
    for row in rows:
        decision_id = _text(row[0])
        if not decision_id:
            continue
        reviews[decision_id] = {
            "review_date": row[1] if isinstance(row[1], str) else None,
            "result_label": _text(row[2]),
            "outcome_return": _safe_float(row[3]),
            "horizon_days": _safe_int(row[4]),
        }
    return reviews


def _timeline(logs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    decision_dates = [log["date"] for log in logs if log["date"]]
    reviews = [log["review"] for log in logs if log["review"]]

    items: list[dict[str, Any]] = []
    if decision_dates:
        earliest = min(decision_dates)
        items.append(
            {
                "date": earliest,
                "action_type": "decision",
                "summary": f"建立 {len(logs)} 条决策日志，记录方向、依据与时间窗口",
                "rule_ids": ["r1", "r2"],
            }
        )

    review_dates = [
        review["review_date"]
        for review in reviews
        if review and review.get("review_date")
    ]
    if review_dates:
        latest = max(review_dates)
        items.append(
            {
                "date": latest,
                "action_type": "review",
                "summary": f"{len(reviews)} 条判断到期复盘，记录结果与修正",
                "rule_ids": ["r4"],
            }
        )
    return items


def get_discipline_data() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    empty_stats = {
        "total_decisions": 0,
        "open": 0,
        "reviewed": 0,
        "hit": 0,
        "wrong": 0,
        "review_coverage_pct": 0,
        "generated_at": generated_at,
    }

    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            logs = _get_logs(connection)
            reviews = _get_reviews(connection)

        for log in logs:
            log["review"] = reviews.get(log["decision_id"])

        total = len(logs)
        open_count = sum(1 for log in logs if log["status"] == "open")
        reviewed_count = sum(1 for log in logs if log["status"] == "reviewed")
        hit_count = sum(
            1 for review in reviews.values() if review["result_label"] == "hit"
        )
        wrong_count = sum(
            1 for review in reviews.values() if review["result_label"] == "wrong"
        )
        coverage = round(reviewed_count / total * 100) if total else 0

        stats = {
            "total_decisions": total,
            "open": open_count,
            "reviewed": reviewed_count,
            "hit": hit_count,
            "wrong": wrong_count,
            "review_coverage_pct": coverage,
            "generated_at": generated_at,
        }
        return {
            "meta": {"generated_at": generated_at, "source": "live"},
            "principles": PRINCIPLES,
            "stats": stats,
            "framework": FRAMEWORK,
            "timeline": _timeline(logs),
            "decision_logs": logs,
        }
    except Exception:
        return {
            "meta": {"generated_at": generated_at, "source": "live"},
            "principles": PRINCIPLES,
            "stats": empty_stats,
            "framework": FRAMEWORK,
            "timeline": [],
            "decision_logs": [],
        }