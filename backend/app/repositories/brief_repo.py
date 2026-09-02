from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from app.config import BRIEFS_DIR

_FILENAME_PATTERN = re.compile(r"^[\w\u4e00-\u9fa5\-.]+\.md$")
_DATE_PATTERN = re.compile(r"(?<!\d)(\d{4}-\d{2}-\d{2})(?!\d)")


def list_briefs() -> list[dict[str, Any]]:
    try:
        if not BRIEFS_DIR.is_dir():
            return []

        briefs: list[dict[str, Any]] = []
        for path in BRIEFS_DIR.glob("*.md"):
            try:
                if not path.is_file():
                    continue

                # 设计样张不入列表（多空卡样张.md 等）
                if "样张" in path.name or "样卡" in path.name:
                    continue

                stat = path.stat()
                date_match = _DATE_PATTERN.search(path.name)
                date = (
                    date_match.group(1)
                    if date_match
                    else datetime.fromtimestamp(stat.st_mtime).date().isoformat()
                )

                briefs.append(
                    {
                        "filename": path.name,
                        "date": date,
                        "generated_at": datetime.fromtimestamp(
                            stat.st_mtime
                        ).astimezone().isoformat(),
                        "size_bytes": stat.st_size,
                        "_mtime": stat.st_mtime,
                    }
                )
            except Exception:
                continue

        # 同日期去重：优先保留"日报_"前缀文件（agent 正式产出），
        # 其余同日期文件（旧体系/重复生成）丢弃，只留最新一个
        by_date: dict[str, dict[str, Any]] = {}
        for brief in briefs:
            key = brief["date"]
            existing = by_date.get(key)
            if existing is None:
                by_date[key] = brief
                continue
            existing_pref = existing["filename"].startswith("日报_")
            new_pref = brief["filename"].startswith("日报_")
            if existing_pref and not new_pref:
                continue  # 保留已有日报_文件
            if new_pref and not existing_pref:
                by_date[key] = brief  # 新文件是日报_，替换
            elif brief["_mtime"] > existing["_mtime"]:
                by_date[key] = brief  # 同为日报_或同为旧体系，取最新

        result = sorted(by_date.values(), key=lambda item: item["_mtime"], reverse=True)
        for brief in result:
            brief.pop("_mtime", None)

        return result
    except Exception:
        return []


def get_brief(filename: str) -> dict[str, Any] | None:
    try:
        if not isinstance(filename, str) or not _FILENAME_PATTERN.fullmatch(filename):
            return None

        briefs_dir = BRIEFS_DIR.resolve()
        path = (BRIEFS_DIR / filename).resolve()

        if path.parent != briefs_dir or not path.is_file():
            return None

        stat = path.stat()
        return {
            "filename": path.name,
            "content": path.read_text(encoding="utf-8"),
            "generated_at": datetime.fromtimestamp(
                stat.st_mtime
            ).astimezone().isoformat(),
        }
    except Exception:
        return None