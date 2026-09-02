"""部署配置：路径统一由环境变量注入，默认值兼容 Windows 本地开发。

Mac 展示机部署时设置：
  QIANBOSHI_AGENT_DIR=/Users/a1/qianboshi-agent
  QIANBOSHI_DATA_DIR=/Users/a1/qianboshi-agent/data
  QIANBOSHI_NOTES_DIR=/Users/a1/qianboshi-portfolio/notes-vault/钱博士
"""
from __future__ import annotations

import os
from pathlib import Path

AGENT_DIR = Path(os.environ.get("QIANBOSHI_AGENT_DIR", r"E:\qianboshi-agent"))
DATA_DIR = Path(os.environ.get("QIANBOSHI_DATA_DIR", r"E:\qianboshi-agent\data"))
NOTES_DIR = Path(os.environ.get("QIANBOSHI_NOTES_DIR", r"E:\obsidian-vault\学习\钱博士"))

# 派生路径
SCRIPTS_PATH = AGENT_DIR / "scripts"
DATABASE_PATH = DATA_DIR / "qianboshi_decision.db"
STRUCTURED_VIEWS_PATH = DATA_DIR / "views" / "structured_views.jsonl"
VECTOR_DB_PATH = DATA_DIR / "vector_db"
BRIEFS_DIR = DATA_DIR / "briefs"
WEBPAGE_DESIGN_ROOT = DATA_DIR / "webpage_design"
SCHEMA_REPORT_PATH = WEBPAGE_DESIGN_ROOT / "07_schema_report.md"

DATA_ROOT = DATA_DIR  # 兼容旧命名
