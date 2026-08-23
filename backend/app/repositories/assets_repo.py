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

# 证券代码 → 中文名（用于多空对照表展示"名字（代码）"）
# 来源：qianboshi-agent/scripts/expand_market_symbols.py THEME_SYMBOLS 反向 + 常见 ETF
SYMBOL_NAMES = {
    # AI算力/光模块
    "300308.SZ": "中际旭创", "300502.SZ": "新易盛", "300394.SZ": "天孚通信",
    "688498.SS": "源杰科技", "002281.SZ": "光迅科技", "000988.SZ": "华工科技",
    "300570.SZ": "太辰光", "603083.SS": "剑桥科技", "300548.SZ": "博创科技",
    # 半导体/国产算力
    "688981.SS": "中芯国际", "688256.SS": "寒武纪", "688041.SS": "海光信息",
    "688120.SS": "华海清科", "002371.SZ": "北方华创", "688012.SS": "中微公司",
    "688072.SS": "拓荆科技", "688037.SS": "芯源微", "688082.SS": "盛美上海",
    "688126.SS": "沪硅产业", "603501.SS": "韦尔股份", "603986.SS": "兆易创新",
    "688008.SS": "澜起科技", "688047.SS": "龙芯中科", "688347.SS": "华虹公司",
    # 黄金有色/资源
    "601899.SS": "紫金矿业", "600547.SS": "山东黄金", "603993.SS": "洛阳钼业",
    "600489.SS": "中金黄金", "600988.SS": "赤峰黄金", "601069.SS": "西部黄金",
    "601600.SS": "中国铝业", "600362.SS": "江西铜业", "000630.SZ": "铜陵有色",
    # 创新药/CXO
    "600276.SS": "恒瑞医药", "688235.SS": "百济神州", "603259.SS": "药明康德",
    "688331.SS": "荣昌生物", "688180.SS": "君实生物", "002422.SZ": "科伦药业",
    "300759.SZ": "康龙化成", "300347.SZ": "泰格医药", "603127.SS": "昭衍新药",
    # 常见 ETF
    "159813.SZ": "半导体ETF", "159992.SZ": "创新药ETF", "512480.SS": "半导体ETF",
    "518880.SS": "黄金ETF", "512690.SS": "白酒ETF", "510300.SS": "沪深300ETF",
    "510050.SS": "上证50ETF", "510310.SS": "沪深300ETF易方达", "510330.SS": "沪深300ETF华夏",
    # 其他常见个股
    "300750.SZ": "宁德时代", "601127.SS": "赛力斯", "300274.SZ": "阳光电源",
    "603019.SS": "中科曙光", "601888.SS": "中国中免", "300014.SZ": "亿纬锂能",
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
            # 证券代码 → 展示"名字（代码）"；无法识别的代码保留原样
            if "." in entity:
                display_name = SYMBOL_NAMES.get(entity)
                if display_name:
                    entity = f"{display_name}（{entity}）"
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