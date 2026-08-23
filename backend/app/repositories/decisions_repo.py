from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

from app.repositories.overview_repo import DATABASE_PATH


HORIZON_LABELS = {
    "short": "短期",
    "medium": "中期",
    "long": "长期",
}


def _database_uri() -> str:
    return f"file:{DATABASE_PATH.as_posix()}?mode=ro"


def _text(value: Any, default: str = "") -> str:
    return value.strip() if isinstance(value, str) else default


def _nullable_text(value: Any) -> str | None:
    value = _text(value)
    return value or None


def _get_decisions() -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            rows = connection.execute(
                """
                SELECT
                    decision_id,
                    asset_name,
                    asset_type,
                    decision_date,
                    horizon,
                    direction,
                    conviction,
                    thesis,
                    status
                FROM user_decision_logs
                ORDER BY decision_date DESC, created_at DESC, decision_id DESC
                """
            ).fetchall()

        return [
            {
                "decision_id": _text(row[0]),
                "asset_name": _text(row[1]),
                "asset_type": _text(row[2]),
                "decision_date": row[3] if isinstance(row[3], str) else None,
                "horizon": _text(row[4]),
                "direction": _text(row[5]),
                "conviction": float(row[6]) if row[6] is not None else None,
                "thesis": _text(row[7])[:120],
                "status": _text(row[8]),
                "review_result": None,
            }
            for row in rows
        ]
    except Exception:
        return []


def _get_review_results() -> dict[str, str]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            rows = connection.execute(
                """
                SELECT decision_id, result_label
                FROM decision_reviews
                """
            ).fetchall()

        return {
            _text(decision_id): _text(result_label)
            for decision_id, result_label in rows
            if _text(decision_id)
        }
    except Exception:
        return {}


def _get_asset_cards() -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            cards = connection.execute(
                """
                SELECT asset_id, asset_name, asset_type, description
                FROM asset_cards
                ORDER BY asset_name
                """
            ).fetchall()

            factor_rows = connection.execute(
                """
                SELECT asset_id, factor_name, current_state,
                       impact_direction, impact_strength, as_of_date
                FROM (
                    SELECT
                        asset_id,
                        factor_name,
                        current_state,
                        impact_direction,
                        impact_strength,
                        as_of_date,
                        ROW_NUMBER() OVER (
                            PARTITION BY asset_id
                            ORDER BY as_of_date DESC, factor_name
                        ) AS row_number
                    FROM factor_states
                )
                WHERE row_number <= 3
                ORDER BY asset_id, as_of_date DESC, factor_name
                """
            ).fetchall()

        factors_by_asset: dict[str, list[dict[str, Any]]] = {}
        for row in factor_rows:
            asset_id = _text(row[0])
            if not asset_id:
                continue
            factors_by_asset.setdefault(asset_id, []).append(
                {
                    "factor_name": _text(row[1]),
                    "current_state": _text(row[2]),
                    "impact_direction": _text(row[3]),
                    "impact_strength": _text(row[4]),
                }
            )

        return [
            {
                "asset_id": _text(row[0]),
                "asset_name": _text(row[1]),
                "asset_type": _text(row[2]),
                "description": _text(row[3]),
                "factors": factors_by_asset.get(_text(row[0]), []),
            }
            for row in cards
        ]
    except Exception:
        return []


def _get_reviews() -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            rows = connection.execute(
                """
                SELECT
                    reviews.decision_id,
                    logs.asset_name,
                    logs.direction,
                    reviews.review_date,
                    reviews.result_label,
                    reviews.outcome_return,
                    reviews.horizon_days,
                    reviews.new_rule_learned
                FROM decision_reviews AS reviews
                LEFT JOIN user_decision_logs AS logs
                    ON logs.decision_id = reviews.decision_id
                ORDER BY reviews.review_date DESC, reviews.decision_id DESC
                """
            ).fetchall()

        return [
            {
                "decision_id": _text(row[0]),
                "asset_name": _text(row[1]),
                "direction": _text(row[2]),
                "review_date": row[3] if isinstance(row[3], str) else None,
                "result_label": _text(row[4]),
                "outcome_return": (
                    float(row[5]) if row[5] is not None else None
                ),
                "horizon_days": int(row[6]) if row[6] is not None else None,
                "new_rule_learned": _nullable_text(row[7]),
            }
            for row in rows
        ]
    except Exception:
        return []


def get_decisions_data() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()

    decisions = _get_decisions()
    review_results = _get_review_results()

    for decision in decisions:
        decision["review_result"] = review_results.get(decision["decision_id"])

    reviews = _get_reviews()
    total = len(decisions)
    open_count = sum(1 for decision in decisions if decision["status"] == "open")
    reviewed_count = sum(
        1 for decision in decisions if decision["status"] == "reviewed"
    )
    hit_count = sum(1 for review in reviews if review["result_label"] == "hit")
    wrong_count = sum(1 for review in reviews if review["result_label"] == "wrong")

    return {
        "stats": {
            "total": total,
            "open": open_count,
            "reviewed": reviewed_count,
            "hit": hit_count,
            "wrong": wrong_count,
            "generated_at": generated_at,
        },
        "decisions": decisions,
        "asset_cards": _get_asset_cards(),
        "reviews": reviews,
    }