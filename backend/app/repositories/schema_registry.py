from app.config import DATA_ROOT, DATABASE_PATH, SCHEMA_REPORT_PATH

STRUCTURED_VIEWS_PATH = DATA_ROOT / "views" / "structured_views.jsonl"
WEBPAGE_DESIGN_ROOT = DATA_ROOT / "webpage_design"

DATA_PATHS = {
    "data_root": DATA_ROOT,
    "database": DATABASE_PATH,
    "structured_views": STRUCTURED_VIEWS_PATH,
    "schema_report": SCHEMA_REPORT_PATH,
}

KNOWN_TABLES: tuple[str, ...] = ()