from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import sqlite3
import subprocess
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from app.config import DATABASE_PATH, DATA_ROOT, NOTES_DIR as NOTE_DIR

VIEWS_PATH = DATA_ROOT / "views" / "structured_views.jsonl"

_DATE_PREFIX_PATTERN = re.compile(r"^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s+|$)")
_FRONTMATTER_PATTERN = re.compile(
    r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)",
    re.DOTALL,
)
_WHITESPACE_PATTERN = re.compile(r"\s+")


def _note_id_from_filename(filename: str) -> str:
    return hashlib.sha256(filename.encode("utf-8")).hexdigest()[:12]


def _parse_frontmatter(content: str) -> dict:
    match = _FRONTMATTER_PATTERN.match(content.lstrip("\ufeff"))
    if match is None:
        return {}

    raw_frontmatter = match.group(1)

    try:
        import yaml

        parsed = yaml.safe_load(raw_frontmatter)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return _parse_frontmatter_fallback(raw_frontmatter)


def _parse_frontmatter_fallback(raw_frontmatter: str) -> dict:
    result: dict[str, Any] = {}
    active_list_key: str | None = None

    for raw_line in raw_frontmatter.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped or stripped.startswith("#"):
            continue

        if active_list_key and stripped.startswith("- "):
            value = _clean_yaml_scalar(stripped[2:])
            if value:
                current = result.setdefault(active_list_key, [])
                if isinstance(current, list):
                    current.append(value)
            continue

        active_list_key = None
        if ":" not in line:
            continue

        key, raw_value = line.split(":", 1)
        key = key.strip()
        value = raw_value.strip()

        if key not in {"date", "created", "tags", "source"}:
            continue

        if not value:
            result[key] = []
            active_list_key = key
            continue

        if key == "tags" and value.startswith("[") and value.endswith("]"):
            result[key] = [
                cleaned
                for item in value[1:-1].split(",")
                if (cleaned := _clean_yaml_scalar(item))
            ]
        else:
            result[key] = _clean_yaml_scalar(value)

    return result


def _clean_yaml_scalar(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) >= 2 and cleaned[0] == cleaned[-1] and cleaned[0] in {'"', "'"}:
        cleaned = cleaned[1:-1]
    return cleaned.strip()


def _parse_title(filename: str) -> str:
    stem = Path(filename).stem.strip()
    return _DATE_PREFIX_PATTERN.sub("", stem, count=1).strip() or stem


def _parse_note_date(filename: str) -> str | None:
    match = _DATE_PREFIX_PATTERN.match(Path(filename).stem.strip())
    if match is None:
        return None

    try:
        parsed = date(
            int(match.group(1)),
            int(match.group(2)),
            int(match.group(3)),
        )
        return parsed.isoformat()
    except ValueError:
        return None


def _normalise_scalar(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    if isinstance(value, (int, float)):
        return str(value)
    return None


def _normalise_tags(value: Any) -> list[str]:
    if isinstance(value, str):
        candidates = value.split(",")
    elif isinstance(value, (list, tuple, set)):
        candidates = list(value)
    else:
        return []

    tags: list[str] = []
    seen: set[str] = set()

    for candidate in candidates:
        tag = _normalise_scalar(candidate)
        if tag is None:
            continue
        tag = tag.lstrip("#").strip()
        key = tag.casefold()
        if tag and key not in seen:
            seen.add(key)
            tags.append(tag)

    return tags


def _markdown_body(content: str) -> str:
    normalised = content.lstrip("\ufeff")
    match = _FRONTMATTER_PATTERN.match(normalised)
    if match is None:
        return normalised
    return normalised[match.end() :]


def _make_excerpt(content: str, limit: int = 160) -> str:
    body = _markdown_body(content)
    text = _WHITESPACE_PATTERN.sub(" ", body).strip()
    return text[:limit]


def _is_within_note_dir(path: Path) -> bool:
    try:
        path.resolve().relative_to(NOTE_DIR.resolve())
        return True
    except (OSError, ValueError):
        return False


def _iter_note_paths() -> list[Path]:
    try:
        root = NOTE_DIR.resolve()
        if not root.is_dir():
            return []

        paths: list[Path] = []
        for candidate in root.rglob("*.md"):
            try:
                resolved = candidate.resolve()
                if resolved.is_file() and _is_within_note_dir(resolved):
                    paths.append(resolved)
            except OSError:
                continue

        return sorted(paths, key=lambda item: (item.name.casefold(), str(item)))
    except OSError:
        return []


def _read_note(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError):
        return None


_SCAN_NOTES_CACHE: list[dict] | None = None


def _scan_notes(force: bool = False) -> list[dict]:
    global _SCAN_NOTES_CACHE
    if _SCAN_NOTES_CACHE is not None and not force:
        return _SCAN_NOTES_CACHE

    notes: list[dict[str, Any]] = []

    for path in _iter_note_paths():
        content = _read_note(path)
        if content is None:
            continue

        try:
            stat = path.stat()
        except OSError:
            continue

        frontmatter = _parse_frontmatter(content)
        filename = path.name
        frontmatter_date = _normalise_scalar(frontmatter.get("date"))
        note_date = _parse_note_date(filename) or frontmatter_date
        created_at = _normalise_scalar(frontmatter.get("created"))
        source = _normalise_scalar(frontmatter.get("source"))

        notes.append(
            {
                "note_id": _note_id_from_filename(filename),
                "filename": filename,
                "title": _parse_title(filename),
                "note_date": note_date,
                "created_at": created_at,
                "tags": _normalise_tags(frontmatter.get("tags")),
                "source": source,
                "excerpt": _make_excerpt(content),
                "size_bytes": stat.st_size,
                "file_mtime": datetime.fromtimestamp(
                    stat.st_mtime,
                    tz=timezone.utc,
                ).isoformat(),
            }
        )

    _SCAN_NOTES_CACHE = notes
    return _SCAN_NOTES_CACHE


def _source_filename(source_path: Any) -> str | None:
    if not isinstance(source_path, str) or not source_path.strip():
        return None
    normalised = source_path.strip().replace("\\", "/")
    filename = normalised.rsplit("/", 1)[-1].strip()
    return filename or None


_VIEWS_INDEX_CACHE: dict[str, int] | None = None


def _views_index(force: bool = False) -> dict[str, int]:
    """文件名→观点数。全量扫描 9727 行 JSONL 较慢，缓存结果避免每篇笔记重建。"""
    global _VIEWS_INDEX_CACHE
    if _VIEWS_INDEX_CACHE is not None and not force:
        return _VIEWS_INDEX_CACHE

    counts: Counter[str] = Counter()

    try:
        with VIEWS_PATH.open(encoding="utf-8-sig") as file:
            for line in file:
                if not line.strip():
                    continue

                try:
                    record = json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    continue

                if not isinstance(record, dict):
                    continue

                filename = _source_filename(record.get("source_path"))
                if filename:
                    counts[filename] += 1
    except (OSError, UnicodeError):
        return {}

    _VIEWS_INDEX_CACHE = dict(counts)
    return _VIEWS_INDEX_CACHE


def _database_uri() -> str:
    return f"file:{DATABASE_PATH.as_posix()}?mode=ro"


def _count_database_rows(table_name: str) -> int | None:
    allowed_tables = {"asset_cards", "rag_chunks"}
    if table_name not in allowed_tables:
        return None

    try:
        with sqlite3.connect(_database_uri(), uri=True) as connection:
            row = connection.execute(
                f"SELECT COUNT(*) FROM {table_name}"
            ).fetchone()
        return int(row[0]) if row is not None else None
    except (sqlite3.Error, OSError, TypeError, ValueError):
        return None


def _count_jsonl_records(path: Path) -> int | None:
    try:
        count = 0
        with path.open(encoding="utf-8-sig") as file:
            for line in file:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    continue
                if isinstance(record, dict):
                    count += 1
        return count
    except (OSError, UnicodeError):
        return None


def _count_rag_chunks() -> int | None:
    database_count = _count_database_rows("rag_chunks")
    if database_count is not None:
        return database_count

    candidates = (
        DATA_ROOT / "rag" / "chunks.jsonl",
        DATA_ROOT / "rag_chunks.jsonl",
        DATA_ROOT / "rag" / "rag_chunks.jsonl",
    )
    for candidate in candidates:
        count = _count_jsonl_records(candidate)
        if count is not None:
            return count
    return None


def get_vault_summary() -> dict:
    notes = _scan_notes()
    note_dates = [
        item["note_date"]
        for item in notes
        if isinstance(item.get("note_date"), str)
    ]

    return {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "obsidian-vault",
        },
        "notes_count": len(notes),
        "views_count": _count_jsonl_records(VIEWS_PATH),
        "chunks_count": _count_rag_chunks(),
        "assets_count": _count_database_rows("asset_cards"),
        "latest_note_date": max(note_dates) if note_dates else None,
        "modes": ["notes", "search", "assets"],
    }


def _parse_filter_date(value: str | None) -> date | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def _note_date_value(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def list_notes(
    page: int,
    page_size: int,
    query: str | None,
    date_from: str | None,
    date_to: str | None,
    tags: list[str] | None,
    source: str | None,
    sort: str,
) -> dict:
    safe_page = max(1, int(page))
    safe_page_size = min(5000, max(1, int(page_size)))
    query_value = query.strip().casefold() if isinstance(query, str) else ""
    source_value = source.strip().casefold() if isinstance(source, str) else ""
    from_value = _parse_filter_date(date_from)
    to_value = _parse_filter_date(date_to)
    tag_filters = {
        tag.strip().lstrip("#").casefold()
        for tag in (tags or [])
        if isinstance(tag, str) and tag.strip()
    }
    view_counts = _views_index()
    filtered: list[dict[str, Any]] = []

    for note in _scan_notes():
        content: str | None = None

        if query_value:
            path = _find_note_path(
                note["note_id"],
                expected_filename=note["filename"],
            )
            content = _read_note(path) if path is not None else None
            haystack = "\n".join(
                (
                    str(note.get("title") or ""),
                    str(note.get("filename") or ""),
                    content or "",
                )
            ).casefold()
            if query_value not in haystack:
                continue

        parsed_note_date = _note_date_value(note.get("note_date"))
        if from_value is not None and (
            parsed_note_date is None or parsed_note_date < from_value
        ):
            continue
        if to_value is not None and (
            parsed_note_date is None or parsed_note_date > to_value
        ):
            continue

        note_tags = {
            item.casefold()
            for item in note.get("tags", [])
            if isinstance(item, str)
        }
        if tag_filters and note_tags.isdisjoint(tag_filters):
            continue

        note_source = note.get("source")
        if source_value and (
            not isinstance(note_source, str)
            or source_value not in note_source.casefold()
        ):
            continue

        filtered.append(
            {
                "note_id": note["note_id"],
                "filename": note["filename"],
                "title": note["title"],
                "note_date": note["note_date"],
                "created_at": note["created_at"],
                "tags": note["tags"],
                "source": note["source"],
                "excerpt": note["excerpt"],
                "structured_view_count": view_counts.get(note["filename"], 0),
                "size_bytes": note["size_bytes"],
            }
        )

    sort_value = sort if sort in {"date_desc", "date_asc", "title"} else "date_desc"

    if sort_value == "title":
        filtered.sort(
            key=lambda item: (
                str(item.get("title") or "").casefold(),
                str(item.get("filename") or "").casefold(),
            )
        )
    elif sort_value == "date_asc":
        filtered.sort(
            key=lambda item: (
                item.get("note_date") is None,
                str(item.get("note_date") or ""),
                str(item.get("title") or "").casefold(),
            )
        )
    else:
        filtered.sort(
            key=lambda item: (
                item.get("note_date") is not None,
                str(item.get("note_date") or ""),
                str(item.get("title") or "").casefold(),
            ),
            reverse=True,
        )

    total = len(filtered)
    offset = (safe_page - 1) * safe_page_size
    data = filtered[offset : offset + safe_page_size]

    return {
        "data": data,
        "pagination": {
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total,
            "has_more": offset + len(data) < total,
        },
    }


def _find_note_path(
    note_id: str,
    expected_filename: str | None = None,
) -> Path | None:
    if not isinstance(note_id, str) or not re.fullmatch(r"[0-9a-f]{12}", note_id):
        return None

    if expected_filename is None:
        # 从扫描缓存里找匹配的 filename，避免每次 rglob 全目录
        for note in _scan_notes():
            if note.get("note_id") == note_id:
                expected_filename = note.get("filename")
                break

    if expected_filename is None:
        return None

    candidate = (NOTE_DIR.resolve() / expected_filename).resolve()
    if not candidate.is_file():
        return None
    return candidate if _is_within_note_dir(candidate) else None


_VIEWS_BY_FILE_CACHE: dict[str, list[dict]] | None = None


def _views_by_file(force: bool = False) -> dict[str, list[dict]]:
    """文件名→该文件的 views 列表。一次扫描 9727 行 JSONL 建索引，后续命中缓存。"""
    global _VIEWS_BY_FILE_CACHE
    if _VIEWS_BY_FILE_CACHE is not None and not force:
        return _VIEWS_BY_FILE_CACHE

    by_file: dict[str, list[dict]] = {}
    try:
        with VIEWS_PATH.open(encoding="utf-8-sig") as file:
            for line in file:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except (json.JSONDecodeError, TypeError):
                    continue
                if not isinstance(record, dict):
                    continue
                filename = _source_filename(record.get("source_path"))
                if filename:
                    by_file.setdefault(filename, []).append(record)
    except (OSError, UnicodeError):
        return {}

    _VIEWS_BY_FILE_CACHE = by_file
    return _VIEWS_BY_FILE_CACHE


def _related_views(filename: str, limit: int = 5) -> list[dict]:
    matches: list[dict[str, Any]] = []

    for record in _views_by_file().get(filename, []):
        evidence = record.get("evidence")
        if isinstance(evidence, list):
            evidence_text = " ".join(
                str(item).strip()
                for item in evidence
                if item is not None and str(item).strip()
            )
        elif isinstance(evidence, dict):
            evidence_text = json.dumps(
                evidence,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        elif evidence is None:
            evidence_text = ""
        else:
            evidence_text = str(evidence).strip()

        confidence = record.get("confidence")
        try:
            confidence_value = (
                float(confidence) if confidence is not None else None
            )
        except (TypeError, ValueError):
            confidence_value = None

        matches.append(
            {
                "view_id": str(record.get("view_id") or ""),
                "analyst": str(record.get("analyst") or ""),
                "claim": str(record.get("claim") or ""),
                "date": _normalise_scalar(record.get("date")),
                "stance": str(record.get("stance") or ""),
                "confidence": confidence_value,
                "section": _normalise_scalar(record.get("section")),
                "evidence": evidence_text[:200],
            }
        )

    matches.sort(
        key=lambda item: (
            item.get("date") is not None,
            str(item.get("date") or ""),
            str(item.get("view_id") or ""),
        ),
        reverse=True,
    )
    return matches[:limit]


def get_note_detail(note_id: str) -> dict | None:
    scanned_note = next(
        (
            note
            for note in _scan_notes()
            if note.get("note_id") == note_id
        ),
        None,
    )
    if scanned_note is None:
        return None

    path = _find_note_path(
        note_id,
        expected_filename=scanned_note["filename"],
    )
    if path is None:
        return None

    content = _read_note(path)
    if content is None:
        return None

    return {
        "note_id": scanned_note["note_id"],
        "filename": scanned_note["filename"],
        "title": scanned_note["title"],
        "note_date": scanned_note["note_date"],
        "created_at": scanned_note["created_at"],
        "tags": scanned_note["tags"],
        "source": scanned_note["source"],
        "excerpt": scanned_note["excerpt"],
        "structured_view_count": _views_index().get(
            scanned_note["filename"],
            0,
        ),
        "size_bytes": scanned_note["size_bytes"],
        "content": _markdown_body(content),
        "related_views": _related_views(scanned_note["filename"]),
    }


def _is_dev_environment() -> bool:
    environment = (
        os.getenv("QIANBOSHI_ENV")
        or os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or ""
    ).strip().casefold()
    return environment in {"dev", "development", "local"}


def open_note_local(note_id: str) -> dict:
    if not _is_dev_environment():
        raise PermissionError("local note opening is disabled")

    scanned_note = next(
        (
            note
            for note in _scan_notes()
            if note.get("note_id") == note_id
        ),
        None,
    )
    if scanned_note is None:
        raise FileNotFoundError("note not found")

    path = _find_note_path(
        note_id,
        expected_filename=scanned_note["filename"],
    )
    if path is None or not path.is_file() or not _is_within_note_dir(path):
        raise FileNotFoundError("note not found")

    system = platform.system()
    if system == "Windows":
        os.startfile(str(path))
    elif system == "Darwin":
        subprocess.Popen(
            ["open", str(path)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        raise OSError("local note opening is unsupported on this platform")

    return {"opened": True, "note_id": note_id}