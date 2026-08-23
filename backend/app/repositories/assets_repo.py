from __future__ import annotations

import json
import sqlite3
from collections import Counter, deque
from datetime import datetime, timezone
from typing import Any

from app.repositories.overview_repo import (
    DATABASE_PATH,
    STRUCTURED_VIEWS_PATH,
    _count_notes,
    _count_prediction_events,
    _count_rag_chunks,
    _count_structured_views,
)

STANCE_LABELS = {
    "bullish": "看多",
    "bearish": "看空",
    "neutral": "中性",
    "watch": "观察",
    "risk": "风险",
}

HORIZON_LABELS = {
    "intraday": "日内",
    "short": "短期",
    "medium": "中期",
    "long": "长期",
    "unknown": "未标注",
}


def _database_uri() -> str:
    return f"file:{DATABASE_PATH.as_posix()}?mode=ro"


def _scan_structured_views() -> dict[str, Any]:
    stance_counts: Counter[str] = Counter()
    horizon_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    analysts: set[str] = set()
    samples: deque[dict[str, Any]] = deque(maxlen=5)

    try:
        with STRUCTURED_VIEWS_PATH.open(encoding="utf-8") as file:
            for line in file:
                if not line.strip():
                    continue

                try:
                    record = json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    continue

                if not isinstance(record, dict):
                    continue

                stance = record.get("stance")
                if isinstance(stance, str) and stance in STANCE_LABELS:
                    stance_counts[stance] += 1

                horizon = record.get("horizon")
                if not isinstance(horizon, str) or horizon not in HORIZON_LABELS:
                    horizon = "unknown"
                horizon_counts[horizon] += 1

                analyst = record.get("analyst")
                if isinstance(analyst, str) and analyst.strip():
                    analyst = analyst.strip()
                    analysts.add(analyst)
                    source_counts[analyst] += 1
                else:
                    analyst = ""

                claim = record.get("claim")
                claim_text = claim.strip()[:80] if isinstance(claim, str) else ""

                date = record.get("date")
                date_value = date if isinstance(date, str) else None

                samples.append(
                    {
                        "analyst": analyst,
                        "date": date_value,
                        "stance": stance if isinstance(stance, str) else "",
                        "claim": claim_text,
                    }
                )

        return {
            "stance_dist": [
                {
                    "name": name,
                    "label_zh": label,
                    "value": stance_counts[name],
                }
                for name, label in STANCE_LABELS.items()
            ],
            "horizon_dist": [
                {
                    "name": name,
                    "label_zh": label,
                    "value": horizon_counts[name],
                }
                for name, label in HORIZON_LABELS.items()
            ],
            "source_contrib": [
                {"name": name, "views": views}
                for name, views in source_counts.most_common(10)
            ],
            "analysts": len(analysts),
            "sample_views": list(reversed(samples)),
        }
    except Exception:
        return {
            "stance_dist": [],
            "horizon_dist": [],
            "source_contrib": [],
            "analysts": None,
            "sample_views": [],
        }


def _count_asset_cards() -> int | None:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            row = connection.execute("SELECT COUNT(*) FROM asset_cards").fetchone()
        return int(row[0]) if row is not None else None
    except Exception:
        return None


def _get_analyst_rank() -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            rows = connection.execute(
                "SELECT analyst, sample_count, hit_rate FROM analyst_scores"
            ).fetchall()

        best_by_analyst: dict[str, tuple[int | None, float | None]] = {}

        for analyst, sample_count, hit_rate in rows:
            if not isinstance(analyst, str) or not analyst.strip():
                continue

            name = analyst.strip()
            samples = int(sample_count) if sample_count is not None else None
            rate = round(float(hit_rate), 4) if hit_rate is not None else None

            current = best_by_analyst.get(name)
            current_samples = (
                current[0] if current is not None and current[0] is not None else -1
            )
            candidate_samples = samples if samples is not None else -1

            if current is None or candidate_samples > current_samples:
                best_by_analyst[name] = (samples, rate)

        ranked = sorted(
            best_by_analyst.items(),
            key=lambda item: (
                item[1][1] is not None,
                item[1][1] if item[1][1] is not None else -1.0,
                item[1][0] if item[1][0] is not None else -1,
            ),
            reverse=True,
        )

        return [
            {
                "name": name,
                "hit_rate": values[1],
                "samples": values[0],
            }
            for name, values in ranked[:8]
        ]
    except Exception:
        return []


def _get_debate_cards() -> list[dict[str, Any]]:
    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            rows = connection.execute(
                """
                SELECT
                    entity_name,
                    bullish_count,
                    bearish_count,
                    neutral_count,
                    consensus_direction,
                    disagreement_level,
                    updated_at
                FROM debate_cards
                ORDER BY (bullish_count + bearish_count + neutral_count) DESC, updated_at DESC
                LIMIT 24
                """
            ).fetchall()

        cards: dict[str, dict[str, Any]] = {}
        for (
            entity_name,
            bullish_count,
            bearish_count,
            neutral_count,
            consensus_direction,
            disagreement_level,
            updated_at,
        ) in rows:
            if not isinstance(entity_name, str) or not entity_name.strip():
                continue
            entity = entity_name.strip()
            item = {
                "entity": entity,
                "bullish": int(bullish_count or 0),
                "bearish": int(bearish_count or 0),
                "neutral": int(neutral_count or 0),
                "consensus": consensus_direction
                if isinstance(consensus_direction, str)
                else "",
                "disagreement": round(float(disagreement_level), 4)
                if disagreement_level is not None
                else None,
                "updated": updated_at if isinstance(updated_at, str) else None,
            }
            # 同实体多时间窗去重：保留观点总数最大的
            existing = cards.get(entity)
            if existing is None or (
                item["bullish"] + item["bearish"] + item["neutral"]
                > existing["bullish"] + existing["bearish"] + existing["neutral"]
            ):
                cards[entity] = item

        return sorted(
            cards.values(),
            key=lambda c: c["bullish"] + c["bearish"] + c["neutral"],
            reverse=True,
        )[:8]
    except Exception:
        return []


def get_assets_data() -> dict[str, Any]:
    views_data = _scan_structured_views()

    return {
        "metrics": {
            "structured_views": _count_structured_views(),
            "prediction_events": _count_prediction_events(),
            "notes": _count_notes(),
            "rag_chunks": _count_rag_chunks(),
            "analysts": views_data["analysts"],
            "asset_cards": _count_asset_cards(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "stance_dist": views_data["stance_dist"],
        "horizon_dist": views_data["horizon_dist"],
        "source_contrib": views_data["source_contrib"],
        "analyst_rank": _get_analyst_rank(),
        "debate_cards": _get_debate_cards(),
        "sample_views": views_data["sample_views"],
    }