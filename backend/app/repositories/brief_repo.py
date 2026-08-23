from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any

BRIEFS_DIR = Path(r"E:\qianboshi-agent\data\briefs")

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

        briefs.sort(key=lambda item: item["_mtime"], reverse=True)
        for brief in briefs:
            brief.pop("_mtime", None)

        return briefs
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