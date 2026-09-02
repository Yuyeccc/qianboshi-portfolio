"""cognitive_repo.py — 认知内核数据聚合（作品集网页 P0）

数据源（全部只读，不修改源库）：
1. E:\\qianboshi-agent\\data\\views\\dimensions_export.json  7484 条维度映射（8-31 导出）
2. E:\\qianboshi-agent\\data\\views\\conflicts_export.json  465 冲突 + 119 分歧（8-31）
3. E:\\qianboshi-agent\\data\\qianboshi_decision.db         回测/资产卡/决策（本地真实库 35MB）
4. COGNITIVE_FACTS：来自 Mac 权威库 73 号交接校验口径（2026-09-01 全量校验通过），
   本地 evidence/quality.db 是空壳（0 字节），总量数字用校验事实常量 + source 标注。

口径红线：所有数字真实可溯；不确定/缺失显式标注（na/insufficient），不伪造 0。
"""

from __future__ import annotations

import functools
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(r"E:\qianboshi-agent\data")
VIEWS_DIR = DATA_DIR / "views"
DIMENSIONS_FILE = VIEWS_DIR / "dimensions_export.json"
CONFLICTS_FILE = VIEWS_DIR / "conflicts_export.json"
STRUCTURED_VIEWS_FILE = VIEWS_DIR / "structured_views.jsonl"
DECISION_DB = DATA_DIR / "qianboshi_decision.db"

# ---------------------------------------------------------------------------
# 校验事实常量（数据源：73 号交接文档 2026-09-01 全量校验 / 各执行记录）
# 本地空壳库读不到的总量数字，全部来自 Mac 权威库实测校验，标注来源文档号。
# ---------------------------------------------------------------------------
COGNITIVE_FACTS: dict[str, Any] = {
    # 三库底座（73 号交接：全量校验 2026-09-01 16:40 实测通过）
    "transcript_segments": {"value": 1_364_250, "unit": "条", "source": "evidence 库 transcript_segment（33 蓝图，2026-08-29）"},
    "view_raw": {"value": 11_311, "unit": "条", "source": "quality 库 view_raw（immutable，md5 留底）"},
    "anchored": {"value": 7_660, "unit": "条", "source": "view_provenance anchored，73 号校验 2026-09-01"},
    "annotations": {"value": 7_736, "unit": "条", "source": "view_evidence_annotation 全量标注，73 号校验（7484+252）"},
    "claims": {"value": 7_736, "unit": "条", "source": "claim 确定性回填，73 号校验（7484+252）"},
    "evidence_links": {"value": 48_593, "unit": "条", "source": "view_evidence_link 观点↔segment 下钻关联（33 蓝图）"},
    "reasoning_units": {"value": 7_476, "unit": "条", "source": "reasoning_unit 五元组全量覆盖 7476/7484（43 号执行记录）"},
    # 预测约束（67/65 号执行记录）
    "prediction_confidence_range": {"value": [0.49, 0.65], "unit": "实证查表", "source": "prediction_confidence.py authority×tuple_status（67 号）"},
    "crowding_topics": {"value": 463, "unit": "topic", "source": "export_dimensions 实测 463 topic 零打满（36 蓝图附录D）"},
    # 合规与纪律（63/51 号执行记录）
    "output_gate": {"value": [22, 22], "unit": "红队 22/22", "source": "output_gate 红队全过（63 号）"},
    "discipline_layers": {"value": 3, "unit": "层", "source": "主题仓位/单标的上限/回撤开关（#17v2，51 号）"},
    # 实盘验证（position_ledger / permutation_test / 69 号）
    "fifo_realized": {"value": 128.91, "unit": "FIFO 精确对账一致", "source": "position_ledger.py realized 对账（git 9e24412）"},
    "permutation": {"value": {"w3": 0.022, "w5": 0.023}, "unit": "p 值", "source": "permutation_test.py 置换检验 OOS 显著（9-01）"},
    "history_fix": {"value": "6984 → 9935", "unit": "+42%", "source": "行情补拉复跑 resolved（69 号）"},
    # 诚实数据叙事（72/49 号执行记录）
    "placeholder_fix": {
        "value": {"fake_anchored": 1153, "real_anchored": 1040, "honest_downgrade": 113},
        "unit": "条",
        "source": "占位锚点修复：假锚定→真实锚定+诚实降级（72 号）",
    },
    "mismatch_fix": {
        "value": {"before": "10.4%", "after": "~3.3%"},
        "unit": "真错配率",
        "source": "存量错配批量修复三轮（49 号）",
    },
}


def _generated_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(path: Path, fallback: Any = None) -> Any:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return fallback


def _db_uri() -> str:
    return f"file:{DECISION_DB.as_posix()}?mode=ro"


# ---------------------------------------------------------------------------
# 1. 维度聚合（dimensions_export.json）
# ---------------------------------------------------------------------------
def _aggregate_dimensions() -> dict[str, Any]:
    data = _load_json(DIMENSIONS_FILE)
    if not data or not isinstance(data, dict) or not data.get("dimensions"):
        return {"available": False, "note": "dimensions_export.json 缺失或为空"}

    dims = data["dimensions"]
    total = len(dims)

    source_layers: dict[str, int] = {}
    verification: dict[str, int] = {}
    supported: dict[str, int] = {}
    claim_levels: dict[str, int] = {}
    confidence_bands: dict[str, int] = {}
    min_dimensions: dict[str, int] = {}
    uncertainty_tags: dict[str, int] = {}
    tuple_status: dict[str, int] = {}
    reasoning_filled: dict[str, int] = {}
    pointers: dict[str, int] = {"ok": 0, "missing": 0, "mismatch": 0}
    topics: set[str] = set()
    match_quality_sum = 0.0
    match_quality_n = 0

    reasoning_fields = ("premise", "mechanism", "conclusion", "trigger_condition", "invalid_condition")

    for rec in dims.values():
        if not isinstance(rec, dict):
            continue
        # 权威分层
        sl = rec.get("source_layer") or "unknown"
        source_layers[sl] = source_layers.get(sl, 0) + 1
        # 核验状态
        vs = rec.get("verification_status") or "unverified"
        verification[vs] = verification.get(vs, 0) + 1
        # 支撑判定
        sup = "supported" if rec.get("supported") else "unsupported"
        supported[sup] = supported.get(sup, 0) + 1
        # claim 分层
        cl = rec.get("claim_level") or "unlabeled"
        claim_levels[cl] = claim_levels.get(cl, 0) + 1
        # 置信三维
        conf = rec.get("confidence") or {}
        band = conf.get("band") or "unrated"
        confidence_bands[band] = confidence_bands.get(band, 0) + 1
        md = conf.get("min_dimension") or "unrated"
        min_dimensions[md] = min_dimensions.get(md, 0) + 1
        # 不确定性标签
        for tag in rec.get("uncertainty_tags") or []:
            uncertainty_tags[tag] = uncertainty_tags.get(tag, 0) + 1
        # topic
        topic = rec.get("topic")
        if topic:
            topics.add(topic)
        # 原文指针状态（evidence 对象缺失/quote 空 = missing）
        ev = rec.get("evidence")
        if not isinstance(ev, dict) or not ev.get("quote_text"):
            pointers["missing"] += 1
        else:
            pointers["ok"] += 1
        # match_quality 均值
        mq = rec.get("match_quality")
        if isinstance(mq, (int, float)):
            match_quality_sum += mq
            match_quality_n += 1
        # reasoning 五元组填充率
        ru = rec.get("reasoning") or {}
        ts = ru.get("tuple_status") or "unknown"
        tuple_status[ts] = tuple_status.get(ts, 0) + 1
        for field in reasoning_fields:
            val = ru.get(field)
            if isinstance(val, str) and val.strip():
                reasoning_filled[field] = reasoning_filled.get(field, 0) + 1

    return {
        "available": True,
        "exported_at": data.get("exported_at"),
        "rule_version": data.get("rule_version"),
        "total": total,
        "topics": len(topics),
        "crowded_topics": len(data.get("crowding") or {}),
        "source_layers": source_layers,
        "verification": verification,
        "supported": supported,
        "claim_levels": claim_levels,
        "confidence_bands": confidence_bands,
        "min_dimensions": min_dimensions,
        "uncertainty_tags": uncertainty_tags,
        "tuple_status": tuple_status,
        "reasoning_filled": reasoning_filled,
        "pointers": pointers,
        "match_quality_avg": round(match_quality_sum / match_quality_n, 3) if match_quality_n else None,
    }


# ---------------------------------------------------------------------------
# 1b. 维度明细分页（P1-B：原文两次点击下钻数据源）
# ---------------------------------------------------------------------------
def get_dimensions_page(
    page: int = 1,
    page_size: int = 20,
    topic: str | None = None,
    pointer: str | None = None,
    claim_level: str | None = None,
    source_layer: str | None = None,
) -> dict[str, Any]:
    """返回维度明细分页，每条含 evidence 原文（quote_text/ts_display/BV/时间戳），
    供前端「观点下钻」第一次点击展开证据卡、第二次点击跳 B 站原文。

    筛选：topic（精确）、pointer（ok/missing/mismatch）、claim_level、source_layer。
    """
    data = _load_json(DIMENSIONS_FILE)
    if not data or not isinstance(data, dict) or not data.get("dimensions"):
        return {"available": False, "note": "dimensions_export.json 缺失或为空", "items": [], "total": 0}

    dims = data["dimensions"]
    items: list[dict[str, Any]] = []
    for claim_id, rec in dims.items():
        if not isinstance(rec, dict):
            continue
        if topic and rec.get("topic") != topic:
            continue
        ev = rec.get("evidence") if isinstance(rec.get("evidence"), dict) else {}
        pointer_status = (
            "ok" if ev.get("quote_text") else "missing"
        )
        if pointer and pointer_status != pointer:
            continue
        if claim_level and rec.get("claim_level") != claim_level:
            continue
        if source_layer and rec.get("source_layer") != source_layer:
            continue
        items.append(
            {
                "claim_id": claim_id,
                "claim": rec.get("claim"),
                "subject_entity": rec.get("subject_entity"),
                "topic": rec.get("topic"),
                "claim_level": rec.get("claim_level"),
                "source_layer": rec.get("source_layer"),
                "verification_status": rec.get("verification_status"),
                "date": rec.get("date"),
                "stance": rec.get("stance"),
                "horizon": rec.get("horizon"),
                "match_quality": rec.get("match_quality"),
                "pointer": pointer_status,
                "evidence": {
                    "bv_id": ev.get("bv_id"),
                    "segment_id": ev.get("segment_id"),
                    "anchor_start_ms": ev.get("anchor_start_ms"),
                    "anchor_end_ms": ev.get("anchor_end_ms"),
                    "ts_display": ev.get("ts_display"),
                    "quote_text": ev.get("quote_text"),
                },
                "reasoning": rec.get("reasoning"),
            }
        )

    items.sort(key=lambda item: (item["date"] or ""), reverse=True)
    total = len(items)
    start = (max(1, page) - 1) * max(1, page_size)
    page_items = items[start : start + max(1, page_size)]

    # topic 候选（筛选器用）
    topic_counts: dict[str, int] = {}
    for item in items:
        topic_counts[item["topic"]] = topic_counts.get(item["topic"], 0) + 1

    return {
        "available": True,
        "exported_at": data.get("exported_at"),
        "total": total,
        "page": max(1, page),
        "page_size": max(1, page_size),
        "topics": [{"topic": t, "count": c} for t, c in sorted(topic_counts.items(), key=lambda kv: -kv[1])],
        "items": page_items,
    }


# ---------------------------------------------------------------------------
# 2. 冲突中心（conflicts_export.json）
# ---------------------------------------------------------------------------
@functools.lru_cache(maxsize=1)
def _load_view_anchor_map() -> dict[str, dict[str, str]]:
    """view_id → {bv_id, ts_display} 锚点映射（structured_views.jsonl，供冲突成员下钻跳 B 站）。

    view_id 与 conflicts 成员同源；匹配不上的成员（约 10%）保持无锚点，
    前端显示「无锚点」而非伪造链接。
    """
    anchor_map: dict[str, dict[str, str]] = {}
    if not STRUCTURED_VIEWS_FILE.exists():
        return anchor_map
    with open(STRUCTURED_VIEWS_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            vid = rec.get("view_id")
            bv = rec.get("source_bv")
            if vid and bv:
                anchor_map[vid] = {
                    "bv_id": bv,
                    "ts_display": rec.get("timestamp"),
                }
    return anchor_map


# 发布日期权威来源：source_file 文件名里的 YYYY.MM.DD / YYYY-MM-DD
# （标注管线 auto 抽取的 date 字段年份不可靠——2026 视频被抽成 2025/2024 甚至 2016，
#   冲突中心实测可校验成员 27.3% 日期错误。文件名日期是 note 收录的发布日期，作为权威。
#   仅当文件名含日期才覆盖；否则保留原始 date 字段，不猜。）
_DATE_RE = re.compile(r"(?<!\d)(\d{4})[.\-](\d{2})[.\-](\d{2})(?!\d)")


def _load_authoritative_date_map() -> dict[str, str]:
    """view_id → 权威发布时间（从 source_file 文件名解析，兼容 YYYY.MM.DD 与 YYYY-MM-DD）。

    与 _load_view_anchor_map 同源（structured_views.jsonl）。文件名无日期的成员
    不在此映射，调用方回退到原始 date 字段。
    """
    date_map: dict[str, str] = {}
    if not STRUCTURED_VIEWS_FILE.exists():
        return date_map
    with open(STRUCTURED_VIEWS_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            vid = rec.get("view_id")
            sf = rec.get("source_file") or ""
            if not vid or not sf:
                continue
            m = _DATE_RE.search(sf)
            if m:
                date_map[vid] = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return date_map


def _aggregate_conflicts() -> dict[str, Any]:
    data = _load_json(CONFLICTS_FILE)
    if not data or not isinstance(data, dict):
        return {"available": False, "note": "conflicts_export.json 缺失或为空"}

    conflicts = data.get("conflicts") or []
    divergences = data.get("divergences") or []
    view_map = data.get("view_conflict_map") or {}
    anchor_map = _load_view_anchor_map()
    date_map = _load_authoritative_date_map()

    # 冲突组摘要（P1-C：全量透出，含成员完整列表；前端筛选器按 topic/level 过滤）
    conflict_summary: list[dict[str, Any]] = []
    for group in conflicts:
        members: list[dict[str, Any]] = []
        for m in (group.get("bull_members") or [])[:4] + (group.get("bear_members") or [])[:4]:
            anchor = anchor_map.get(m.get("view_id") or "")
            vid = m.get("view_id") or ""
            # 日期修复：标注抽取的 date 年份不可靠，优先用 source_file 文件名里的权威日期
            raw_date = m.get("date")
            auth_date = date_map.get(vid)
            members.append(
                {
                    "view_id": vid,
                    "stance": m.get("stance"),
                    "claim": m.get("claim"),
                    "date": auth_date or raw_date,
                    "analyst": m.get("analyst"),
                    "materiality": m.get("materiality"),
                    "bv_id": (anchor or {}).get("bv_id"),
                    "ts_display": (anchor or {}).get("ts_display"),
                }
            )
        conflict_summary.append(
            {
                "group_id": group.get("conflict_group_id"),
                "topic": group.get("topic"),
                "subject_entity": group.get("subject_entity"),
                "level": group.get("level"),
                "n_bull": group.get("n_bull"),
                "n_bear": group.get("n_bear"),
                "n_template": group.get("n_template"),
                "date_min": group.get("date_min"),
                "date_max": group.get("date_max"),
                "members": members,
            }
        )

    return {
        "available": True,
        "exported_at": data.get("exported_at"),
        "rule_version": data.get("rule_version"),
        "exact": len(conflicts),
        "divergences": len(divergences),
        "mapped_views": len(view_map),
        "summary": conflict_summary,
    }


# ---------------------------------------------------------------------------
# 3. 回测（qianboshi_decision.db prediction_backtest_layers，#14v2 OOS 分层）
# ---------------------------------------------------------------------------
def _aggregate_backtest() -> dict[str, Any]:
    try:
        with sqlite3.connect(_db_uri(), uri=True) as connection:
            run = connection.execute(
                "SELECT run_id FROM prediction_backtest_layers ORDER BY run_id DESC LIMIT 1"
            ).fetchone()
            if run is None:
                return {"available": False, "note": "prediction_backtest_layers 为空"}
            run_id = run[0]
            rows = connection.execute(
                "SELECT layer, direction, window_days, segment, sample_type, total, hits, hit_rate, "
                "wilson_low, wilson_high FROM prediction_backtest_layers WHERE run_id = ?",
                (run_id,),
            ).fetchall()

        # 按 (segment, layer, sample_type, window_days) 保留窗口维度
        # （#14v2 结论的关键在 w3/w5 OOS；方向合并=全方向加权，口径保守真实）
        layers: dict[str, dict[str, Any]] = {}
        for layer, direction, window_days, segment, sample_type, total, hits, hit_rate, lo, hi in rows:
            if segment not in ("test", "roll") or sample_type not in ("view", "event"):
                continue
            key = f"{segment}_{layer}_{sample_type}_w{window_days}"
            bucket = layers.setdefault(
                key,
                {
                    "segment": segment,
                    "layer": layer,
                    "sample_type": sample_type,
                    "window_days": window_days,
                    "total": 0,
                    "hits": 0,
                },
            )
            bucket["total"] += total or 0
            bucket["hits"] += hits or 0

        result = {}
        for key, bucket in layers.items():
            total, hits = bucket["total"], bucket["hits"]
            if total == 0:
                rate = None
            else:
                rate = round(hits / total, 4)
            result[key] = {
                "segment": bucket["segment"],
                "layer": bucket["layer"],
                "sample_type": bucket["sample_type"],
                "window_days": bucket["window_days"],
                "total": total,
                "hits": hits,
                "hit_rate": rate,
            }

        return {"available": True, "run_id": run_id, "rows": result, "口径": "OOS test/roll 段，全方向合并，按窗口细分"}
    except Exception:
        return {"available": False, "note": "回测数据读取失败"}


# ---------------------------------------------------------------------------
# 4. 决策闭环（decision.db 现有表）
# ---------------------------------------------------------------------------
def _aggregate_decisions() -> dict[str, Any]:
    try:
        with sqlite3.connect(_db_uri(), uri=True) as connection:
            logs = connection.execute("SELECT COUNT(*) FROM user_decision_logs").fetchone()[0]
            reviews = connection.execute("SELECT COUNT(*) FROM decision_reviews").fetchone()[0]
            cards = connection.execute("SELECT COUNT(*) FROM asset_cards").fetchone()[0]
            events = connection.execute("SELECT COUNT(*) FROM prediction_events").fetchone()[0]
        return {
            "available": True,
            "decision_logs": logs,
            "reviews": reviews,
            "asset_cards": cards,
            "prediction_events": events,
        }
    except Exception:
        return {"available": False, "note": "决策数据读取失败"}


# ---------------------------------------------------------------------------
# 5. 汇总
# ---------------------------------------------------------------------------
def get_cognitive_data() -> dict[str, Any]:
    dimensions = _aggregate_dimensions()
    conflicts = _aggregate_conflicts()
    backtest = _aggregate_backtest()
    decisions = _aggregate_decisions()

    return {
        "meta": {
            "generated_at": _generated_at(),
            "source": "dimensions_export.json 8-31 + conflicts_export.json 8-31 + qianboshi_decision.db + 73 号校验口径",
            "version": "v1",
        },
        "blueprint": {"completed": 19, "total": 19, "status": "done"},
        "facts": COGNITIVE_FACTS,
        "dimensions": dimensions,
        "conflicts": conflicts,
        "backtest": backtest,
        "decisions": decisions,
    }


if __name__ == "__main__":
    import sys

    data = get_cognitive_data()
    print(json.dumps(data, ensure_ascii=False, indent=1)[:4000])
    print("\n...")
    print("SIZE:", len(json.dumps(data, ensure_ascii=False)))
