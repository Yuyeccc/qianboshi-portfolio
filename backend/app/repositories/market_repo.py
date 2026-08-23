from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.repositories.schema_registry import DATA_ROOT, DATABASE_PATH


US_INDICES = [
    ("^DJI", "道琼斯", "Dow Jones"),
    ("^IXIC", "纳斯达克", "NASDAQ Composite"),
    ("^GSPC", "标普500", "S&P 500"),
]

US_STOCKS = [
    ("NVDA", "英伟达", "NVIDIA"),
    ("TSLA", "特斯拉", "Tesla"),
    ("AAPL", "苹果", "Apple"),
    ("MSFT", "微软", "Microsoft"),
    ("AMD", "AMD", "AMD"),
    ("META", "Meta", "Meta Platforms"),
    ("GOOGL", "谷歌", "Alphabet"),
    ("AVGO", "博通", "Broadcom"),
    ("MRVL", "迈威尔", "Marvell Technology"),
    ("SMCI", "超微", "Super Micro Computer"),
]

CN_INDICES = [
    ("000001.SS", "上证指数", "Shanghai Composite"),
    ("399001.SZ", "深证成指", "Shenzhen Component"),
    ("399006.SZ", "创业板指", "ChiNext Index"),
]

PROXY_ASSETS = [
    ("518880.SS", "华安黄金ETF", "Gold ETF", "GOLD"),
    ("159992.SZ", "创新药ETF", "Innovative Drug ETF", "INNOV_DRUG"),
    ("512480.SS", "半导体ETF", "Semiconductor ETF", "TECH"),
]

CACHE_PATH = DATA_ROOT / "market_cache.json"
TRENDS_PATH = DATA_ROOT / "price_trends.json"


def _read_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as stream:
            return json.load(stream)
    except (OSError, TypeError, ValueError):
        return {}


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _record(source: Any, symbol: str) -> dict[str, Any]:
    if not isinstance(source, dict):
        return {}
    value = source.get(symbol)
    if isinstance(value, dict):
        return value
    records = source.get("quotes") or source.get("data") or source.get("market")
    if isinstance(records, list):
        for item in records:
            if isinstance(item, dict) and item.get("symbol") == symbol:
                return item
    return {}


def _trend(source: Any, symbol: str) -> list[dict[str, Any]]:
    value = source.get(symbol) if isinstance(source, dict) else None
    if isinstance(value, dict):
        value = value.get("prices") or value.get("trend") or value.get("data") or value
    if isinstance(value, dict):
        points: list[dict[str, Any]] = []
        for date, item in value.items():
            price = _number(item.get("price") if isinstance(item, dict) else item)
            if price is not None:
                points.append({"date": str(date), "price": price})
        points.sort(key=lambda point: point["date"])
        return points[-5:]
    if not isinstance(value, (list, tuple)):
        return []

    points: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        date = item.get("date")
        price = _number(item.get("price"))
        if date is not None and price is not None:
            points.append({"date": str(date), "price": price})
    points.sort(key=lambda point: point["date"])
    return points[-5:]


def _table_columns(connection: sqlite3.Connection, table: str) -> set[str]:
    try:
        return {str(row[1]) for row in connection.execute(f"PRAGMA table_info({table})")}
    except sqlite3.Error:
        return set()


def _decision(connection: sqlite3.Connection, asset_id: str) -> dict[str, Any] | None:
    columns = _table_columns(connection, "user_decision_logs")
    if not columns:
        return None
    id_column = next(
        (name for name in ("asset_id", "asset", "asset_name") if name in columns),
        None,
    )
    if id_column is None:
        return None

    name_column = "asset_name" if "asset_name" in columns else id_column
    selected = [
        name if name in columns else "NULL"
        for name in ("direction", "status", "asset_name")
    ]
    try:
        row = connection.execute(
            f"SELECT {', '.join(selected)} FROM user_decision_logs "
            f"WHERE {id_column} = ? ORDER BY rowid DESC LIMIT 1",
            (asset_id,),
        ).fetchone()
    except sqlite3.Error:
        return None
    if row is None:
        return None

    result = {
        "asset": _text(row[2]) or asset_id,
        "direction": _text(row[0]),
        "status": _text(row[1]),
        "review_date": None,
    }
    # review_date 来自 decision_reviews（JOIN user_decision_logs.decision_id）
    try:
        review_row = connection.execute(
            "SELECT r.review_date FROM decision_reviews r "
            "JOIN user_decision_logs l ON r.decision_id = l.decision_id "
            "WHERE l.asset_id = ? ORDER BY r.review_date DESC LIMIT 1",
            (asset_id,),
        ).fetchone()
        if review_row:
            result["review_date"] = _text(review_row[0])
    except sqlite3.Error:
        pass
    return result


def _quote(
    symbol: str,
    name: str,
    name_en: str,
    cache: Any,
    trends: Any,
) -> dict[str, Any] | None:
    item = _record(cache, symbol)
    if not item:
        return None
    return {
        "symbol": symbol,
        "name": name,
        "name_en": name_en,
        "price": _number(item.get("price")),
        "change_pct": _number(item.get("change_pct")),
        "trend": _trend(trends, symbol),
    }


def get_market_data() -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    empty = {
        "meta": {"generated_at": generated_at, "data_as_of": None, "source": "yfinance"},
        "us_indices": [],
        "us_stocks": [],
        "cn_indices": [],
        "proxy_assets": [],
    }
    try:
        cache = _read_json(CACHE_PATH)
        trends = _read_json(TRENDS_PATH)
        cache_values = cache.get("quotes", cache) if isinstance(cache, dict) else {}
        updated = _record(cache_values, "^DJI").get("updated")
        data_as_of = str(updated).split(".", 1)[0] if updated else None

        result = {
            "meta": {
                "generated_at": generated_at,
                "data_as_of": data_as_of,
                "source": "yfinance",
            },
            "us_indices": [],
            "us_stocks": [],
            "cn_indices": [],
            "proxy_assets": [],
        }
        for key, definitions in (
            ("us_indices", US_INDICES),
            ("us_stocks", US_STOCKS),
            ("cn_indices", CN_INDICES),
        ):
            for symbol, name, name_en in definitions:
                quote = _quote(symbol, name, name_en, cache_values, trends)
                if quote:
                    result[key].append(quote)

        try:
            connection = sqlite3.connect(f"file:{DATABASE_PATH.as_posix()}?mode=ro", uri=True)
        except (OSError, sqlite3.Error):
            connection = None
        for symbol, name, name_en, asset_id in PROXY_ASSETS:
            quote = _quote(symbol, name, name_en, cache_values, trends)
            if not quote:
                continue
            linked = _decision(connection, asset_id) if connection else None
            quote["linked_decision"] = linked or {
                "asset": asset_id,
                "direction": None,
                "status": None,
                "review_date": None,
            }
            result["proxy_assets"].append(quote)
        if connection:
            connection.close()
        return result
    except Exception:
        return empty