"""研究任务服务：job 文件状态机 + 子进程解耦调用 agent research_agent.py

形态决策（D1，2026-09-03 拍板）：backend 与 agent 研究脚本以子进程解耦
  - 环境隔离：research_agent 需要 Windows 跑批环境（C:/Python314 + 干净 PYTHONPATH），
    与 uvicorn 进程环境不同，子进程天然规避
  - 失败隔离：研究任务 600s 超时 / 脚本崩溃不影响 API 进程
  - 贴合"文件落盘"哲学：job 状态机文件与报告产物均落 DATA_DIR

链路：
  POST /research/jobs
    -> intent_gate.classify_question()（fail-closed：block/clarify 一律拒收）
    -> 写 {job_id}.json (queued) + daemon 线程
    -> subprocess research_agent.py "<goal>" --job-id <job_id>（python 优先级：
       QIANBOSHI_RESEARCH_PYTHON -> C:/Python314/python.exe -> sys.executable）
    -> 扫 DATA_DIR/research/ 下 _meta.job_id == job_id 的产物文件精确关联
    -> 状态机 queued -> running -> done | failed

协议对账：job 文件内保存 intent_gate 的 verdict/reason/rule_version，
与前端 agentScreening.ts 的 RULE_VERSION 对照可发现前后端规则漂移。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import uuid
from datetime import datetime
from pathlib import Path

from app.config import AGENT_DIR, DATA_DIR, SCRIPTS_PATH

JOBS_DIR = DATA_DIR / "research_jobs"
RESEARCH_OUT_DIR = DATA_DIR / "research"
SUB_TIMEOUT = 600  # 单次研究任务超时（秒）

# job 状态机合法值
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_FAILED = "failed"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _ensure_jobs_dir() -> None:
    JOBS_DIR.mkdir(parents=True, exist_ok=True)


def _write_job(job: dict) -> None:
    """原子写 job 文件：先写 temp 再 os.replace。"""
    _ensure_jobs_dir()
    tmp = JOBS_DIR / f".{job['job_id']}.tmp"
    tmp.write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, JOBS_DIR / f"{job['job_id']}.json")


def _update_job(job_id: str, **fields) -> None:
    job = _load_job(job_id)
    if job is None:
        return
    job.update(fields)
    _write_job(job)


def _load_job(job_id: str) -> dict | None:
    p = JOBS_DIR / f"{job_id}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _pick_python() -> str:
    """子进程 python 优先级：显式 env -> 跑批权威 C:/Python314 -> 当前解释器。"""
    for cand in (
        os.environ.get("QIANBOSHI_RESEARCH_PYTHON"),
        r"C:\Python314\python.exe",
        sys.executable,
    ):
        if cand and Path(cand).exists():
            return cand
    return sys.executable


def _find_report(job_id: str) -> Path | None:
    """扫研究产物目录，找 _meta.job_id == job_id 的文件（mtime 最新优先）。"""
    if not RESEARCH_OUT_DIR.exists():
        return None
    candidates = sorted(RESEARCH_OUT_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in candidates:
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if (data.get("_meta") or {}).get("job_id") == job_id:
            return p
    return None


def gate_question(goal: str) -> dict:
    """后端第二道闸：import agent 侧 intent_gate（纯 re，无重依赖）。

    返回 classify_question 的 verdict/reason/category/rule_version。
    """
    scripts = str(SCRIPTS_PATH)
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    try:
        from intent_gate import classify_question  # noqa: F401,E402

        return classify_question(goal)
    except Exception as exc:  # 规则库加载失败 -> fail-closed 拒收
        return {"verdict": "block", "reason": f"intent_gate_unavailable: {exc}", "rule_version": "n/a"}


def submit_job(goal: str, category: str | None = None, gate: dict | None = None) -> dict:
    """建 queued job 并起 daemon 线程执行；立即返回 job 状态（调用方勿阻塞）。"""
    job_id = uuid.uuid4().hex
    job = {
        "job_id": job_id,
        "status": STATUS_QUEUED,
        "goal": goal,
        "category": category,
        "gate": gate or {},
        "created_at": _now(),
        "started_at": None,
        "finished_at": None,
        "report_path": None,
        "error": None,
    }
    _write_job(job)
    threading.Thread(target=_run_job, args=(job_id, goal), daemon=True).start()
    return job


def _run_job(job_id: str, goal: str) -> None:
    _update_job(job_id, status=STATUS_RUNNING, started_at=_now())

    py = _pick_python()
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)  # research_agent 跑批环境要求干净 PYTHONPATH
    cmd = [py, str(SCRIPTS_PATH / "research_agent.py"), goal, "--job-id", job_id]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=SUB_TIMEOUT,
            cwd=str(AGENT_DIR),
            env=env,
        )
    except subprocess.TimeoutExpired:
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error=f"timeout after {SUB_TIMEOUT}s (subprocess killed)",
        )
        return
    except OSError as exc:
        _update_job(job_id, status=STATUS_FAILED, finished_at=_now(), error=f"subprocess failed to start: {exc}")
        return

    stdout = (proc.stdout or "").strip()
    stderr = (proc.stderr or "").strip()

    if proc.returncode != 0:
        tail = (stderr or stdout)[-2000:]
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error=f"exit={proc.returncode}: {tail}",
        )
        return

    report_path = _find_report(job_id)
    if report_path is None:
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error="exit=0 but no report file matched job_id in data/research",
        )
        return

    _update_job(
        job_id,
        status=STATUS_DONE,
        finished_at=_now(),
        report_path=str(report_path),
        error=None,
    )


def get_job(job_id: str) -> dict | None:
    """读 job 文件；done 时若产物可读则附带完整报告（单文件数据源，实时读回）。"""
    job = _load_job(job_id)
    if job is None:
        return None
    if job.get("status") == STATUS_DONE and job.get("report_path"):
        rp = Path(job["report_path"])
        if rp.exists():
            try:
                job["report"] = json.loads(rp.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as exc:
                job["report_error"] = f"unable to read report: {exc}"
    return job


def list_jobs(limit: int = 20) -> list[dict]:
    """最近 limit 个 job 摘要（不含 report 全文）。"""
    _ensure_jobs_dir()
    jobs: list[dict] = []
    for p in JOBS_DIR.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        jobs.append(
            {
                "job_id": data.get("job_id"),
                "status": data.get("status"),
                "goal": data.get("goal"),
                "category": data.get("category"),
                "created_at": data.get("created_at"),
                "finished_at": data.get("finished_at"),
                "report_path": data.get("report_path"),
            }
        )
    jobs.sort(key=lambda j: j.get("created_at") or "", reverse=True)
    return jobs[:limit]
