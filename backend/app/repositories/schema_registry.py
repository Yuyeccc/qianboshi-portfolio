from pathlib import Path

DATA_ROOT = Path(r"E:\qianboshi-agent\data")
DATABASE_PATH = DATA_ROOT / "qianboshi_decision.db"
STRUCTURED_VIEWS_PATH = DATA_ROOT / "views" / "structured_views.jsonl"
WEBPAGE_DESIGN_ROOT = DATA_ROOT / "webpage_design"
SCHEMA_REPORT_PATH = WEBPAGE_DESIGN_ROOT / "07_schema_report.md"

DATA_PATHS = {
    "data_root": DATA_ROOT,
    "database": DATABASE_PATH,
    "structured_views": STRUCTURED_VIEWS_PATH,
    "schema_report": SCHEMA_REPORT_PATH,
}

KNOWN_TABLES: tuple[str, ...] = ()