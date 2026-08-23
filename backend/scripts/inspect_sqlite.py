from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path
from typing import Any

DB = Path(r"E:\qianboshi-agent\data\qianboshi_decision.db")
JSONL = Path(r"E:\qianboshi-agent\data\views\structured_views.jsonl")
REPORT = Path(r"E:\qianboshi-agent\data\webpage_design\07_schema_report.md")


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def format_value(value: Any) -> str:
    if isinstance(value, bytes):
        return f"<bytes:{len(value)}>"
    return repr(value)


def inspect_database() -> list[str]:
    lines = [
        "# SQLite Schema Report",
        "",
        f"- Database: `{DB}`",
        "",
    ]

    if not DB.exists():
        lines.extend(
            [
                "## Database",
                "",
                "Database file not found at the configured path.",
                "",
            ]
        )
        return lines

    try:
        connection = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        lines.extend(["## Database", "", f"Unable to open database read-only: `{exc}`", ""])
        return lines

    try:
        table_rows = connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
            "ORDER BY name"
        ).fetchall()

        if not table_rows:
            lines.extend(["## Tables", "", "No user tables found.", ""])

        for (table_name,) in table_rows:
            columns = connection.execute(
                f"PRAGMA table_info({quote_identifier(table_name)})"
            ).fetchall()
            column_names = [column[1] for column in columns]
            row_count = connection.execute(
                f"SELECT COUNT(*) FROM {quote_identifier(table_name)}"
            ).fetchone()[0]
            samples = connection.execute(
                f"SELECT * FROM {quote_identifier(table_name)} LIMIT 2"
            ).fetchall()

            lines.extend(
                [
                    f"## Table: `{table_name}`",
                    "",
                    f"- Columns: {', '.join(f'`{name}`' for name in column_names) or 'None'}",
                    f"- Row count: `{row_count}`",
                    "- First two rows:",
                    "",
                    "```text",
                ]
            )
            if samples:
                lines.extend(
                    " | ".join(format_value(value) for value in row)
                    for row in samples
                )
            else:
                lines.append("(no rows)")
            lines.extend(["```", ""])
    finally:
        connection.close()

    return lines


def inspect_jsonl() -> list[str]:
    lines = [
        "## Structured JSONL",
        "",
        f"- JSONL: `{JSONL}`",
        "",
    ]

    if not JSONL.exists():
        lines.extend(["JSONL file not found at the configured path.", ""])
        return lines

    records: list[Any] = []
    top_level_fields: set[str] = set()

    with JSONL.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle):
            if not raw_line.strip():
                continue
            try:
                record = json.loads(raw_line)
            except json.JSONDecodeError as exc:
                lines.append(f"- Invalid JSON on source line `{line_number + 1}`: `{exc}`")
                continue

            if len(records) < 3:
                records.append(record)
            if isinstance(record, dict):
                top_level_fields.update(record.keys())

    lines.extend(
        [
            "### First three raw records",
            "",
            "```json",
            json.dumps(records, ensure_ascii=False, indent=2, default=str),
            "```",
            "",
            "### Top-level fields",
            "",
        ]
    )
    if top_level_fields:
        lines.extend(f"- `{field}`" for field in sorted(top_level_fields))
    else:
        lines.append("(none found)")
    lines.append("")

    return lines


def main() -> int:
    report_lines = inspect_database() + inspect_jsonl()
    report = "\n".join(report_lines)

    print(report)

    try:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(report + "\n", encoding="utf-8")
    except OSError as exc:
        print(f"\nUnable to write report to {REPORT}: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())