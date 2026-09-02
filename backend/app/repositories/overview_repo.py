from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import (
    BRIEFS_DIR,
    DATABASE_PATH,
    DATA_DIR,
    NOTES_DIR,
    VECTOR_DB_PATH,
)

STRUCTURED_VIEWS_PATH = DATA_DIR / "views" / "structured_views.jsonl"
MONITOR_STATE_PATH = DATA_DIR / "monitor_state.json"


def _read_monitor_state() -> dict[str, Any] | None:
    try:
        with MONITOR_STATE_PATH.open(encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return None


def _count_structured_views() -> int | None:
    try:
        with STRUCTURED_VIEWS_PATH.open(encoding="utf-8") as file:
            return sum(1 for line in file if line.strip())
    except Exception:
        return None


def _count_prediction_events() -> int | None:
    try:
        database_uri = f"file:{DATABASE_PATH.as_posix()}?mode=ro"
        with sqlite3.connect(database_uri, uri=True) as connection:
            row = connection.execute(
                "SELECT COUNT(*) FROM prediction_events"
            ).fetchone()
        return int(row[0]) if row is not None else None
    except Exception:
        return None


def _count_notes() -> int | None:
    try:
        return sum(1 for path in NOTES_DIR.rglob("*.md") if path.is_file())
    except Exception:
        return None


def _count_rag_chunks() -> int | None:
    # 优先 chromadb 实时统计；旧库在 chromadb 1.5.9 下可能读出 0，
    # 回退到项目自有的构建快照 snapshot.json（记录最近一次构建的 chunks 数）
    try:
        import chromadb

        client = chromadb.PersistentClient(path=str(VECTOR_DB_PATH))
        collection = client.get_collection("qianboshi")
        count = collection.count()
        if isinstance(count, int) and count > 0:
            return count
    except Exception:
        pass
    try:
        snapshot_path = VECTOR_DB_PATH / "snapshot.json"
        if snapshot_path.exists():
            snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
            chunks = snapshot.get("chunks_count")
            if isinstance(chunks, (int, float)) and chunks > 0:
                return int(chunks)
    except Exception:
        pass
    return None


def _count_sources() -> int | None:
    try:
        state = _read_monitor_state()
        channels = state.get("channels") if state else None
        return len(channels) if isinstance(channels, dict) else None
    except Exception:
        return None


def _brief_summary(content: str, max_len: int = 90) -> str:
    for paragraph in re.split(r"\n\s*\n", content):
        lines = [
            line.strip()
            for line in paragraph.splitlines()
            if line.strip()
            and not re.fullmatch(r"={2,}\s*", line.strip())
            and not re.match(r"^#{1,6}\s+", line.strip())
        ]
        if not lines:
            continue

        summary = re.sub(r"[#*>`()\[\]]", "", " ".join(lines))
        summary = re.sub(r"\s+", " ", summary).strip()
        if not summary:
            continue
        # 跳过简报头部标题/模板说明段落，优先取"今日总览"等实质内容
        if ("盘前简报" in summary and len(summary) < 40) or "模板由" in summary:
            continue

        return f"{summary[:max_len]}…" if len(summary) > max_len else summary

    return ""


def get_overview_metrics() -> dict[str, Any]:
    return {
        "structured_views": _count_structured_views(),
        "prediction_events": _count_prediction_events(),
        "notes": _count_notes(),
        "rag_chunks": _count_rag_chunks(),
        "source_count": _count_sources(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_system_status() -> dict[str, Any]:
    state = _read_monitor_state()
    if state is None:
        return {
            "last_checked": None,
            "detected_today": None,
            "source_count": None,
            "pipeline_running": None,
        }

    last_checked = state.get("checked_at")
    pipeline_running = None

    if isinstance(last_checked, str):
        try:
            checked_at = datetime.fromisoformat(last_checked.replace("Z", "+00:00"))
            if checked_at.tzinfo is None:
                checked_at = checked_at.replace(tzinfo=timezone.utc)
            pipeline_running = (
                datetime.now(timezone.utc) - checked_at.astimezone(timezone.utc)
            ).total_seconds() < 6 * 60 * 60
        except (TypeError, ValueError):
            pipeline_running = None

    channels = state.get("channels")
    return {
        "last_checked": last_checked if isinstance(last_checked, str) else None,
        "detected_today": state.get("detected_new_today")
        if isinstance(state.get("detected_new_today"), int)
        else None,
        "source_count": len(channels) if isinstance(channels, dict) else None,
        "pipeline_running": pipeline_running,
    }


def get_latest_brief() -> dict[str, Any]:
    try:
        latest_file = max(
            (path for path in BRIEFS_DIR.glob("*.md") if path.is_file()),
            key=lambda path: path.stat().st_mtime,
        )
        generated_at = datetime.fromtimestamp(
            latest_file.stat().st_mtime, tz=timezone.utc
        ).isoformat()

        summary: str | None = None
        section_count = 0
        try:
            content = latest_file.read_text(encoding="utf-8")
            summary = _brief_summary(content)
            section_count = len(re.findall(r"^##\s+", content, re.MULTILINE))
        except Exception:
            pass

        return {
            "filename": latest_file.name,
            "generated_at": generated_at,
            "summary": summary,
            "section_count": section_count,
        }
    except Exception:
        return {
            "filename": None,
            "generated_at": None,
            "summary": None,
            "section_count": 0,
        }