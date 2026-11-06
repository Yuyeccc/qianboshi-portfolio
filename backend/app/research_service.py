"""研究任务服务：job 文件状态机 + 子进程解耦调用 agent research_agent.py

形态决策（D1，2026-09-03 拍板）：backend 与 agent 研究脚本以子进程解耦
  - 环境隔离：research_agent 需要 Windows 跑批环境（C:/Python314 + 干净 PYTHONPATH），
    与 uvicorn 进程环境不同，子进程天然规避
  - 失败隔离：研究任务 600s 超时 / 脚本崩溃不影响 API 进程
  - 贴合"文件落盘"哲学：job 状态机文件与报告产物均落 DATA_DIR

链路：
  POST /research/jobs
    -> intent_gate.classify_question()（fail-closed：block/clarify 一律拒收）
    -> 写 {job_id}.json (queued) + 有界线程池
    -> Popen research_agent.py "<goal>" --job-id <job_id>（python 优先级：
       QIANBOSHI_RESEARCH_PYTHON -> C:/Python314/python.exe -> sys.executable）
    -> 扫 DATA_DIR/research/ 下 _meta.job_id == job_id 的产物文件精确关联
    -> 状态机 queued -> running -> done | failed

协议对账：job 文件内保存 intent_gate 的 verdict/reason/rule_version，
与前端 agentScreening.ts 的 RULE_VERSION 对照可发现前后端规则漂移。
"""
from __future__ import annotations

import json
import os
import queue
import re
import signal
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from app.config import AGENT_DIR, DATA_DIR, SCRIPTS_PATH

JOBS_DIR = DATA_DIR / "research_jobs"
RESEARCH_OUT_DIR = DATA_DIR / "research"
SUB_TIMEOUT = 600  # 单次研究任务超时（秒）
PROGRESS_EVENT_LIMIT = 20
_PROGRESS_PATTERN = re.compile(r"^\[(\d+[a-z]?/\d+)\]", re.IGNORECASE)
_job_lock = threading.RLock()
_schedule_lock = threading.Lock()
_scheduled_jobs: set[str] = set()


def _create_executor() -> ThreadPoolExecutor:
    try:
        workers = int(os.environ.get("QIANBOSHI_RESEARCH_MAX_WORKERS", "2"))
    except ValueError:
        workers = 2
    return ThreadPoolExecutor(max_workers=max(1, workers), thread_name_prefix="research-job")


_executor = _create_executor()


def _poll_interval() -> None:
    time.sleep(0.05)


# job 状态机合法值
STATUS_QUEUED = "queued"
STATUS_RUNNING = "running"
STATUS_DONE = "done"
STATUS_FAILED = "failed"

# agent 执行器注册表（P2-D：与 agent 仓 orchestrator.AGENT_SCRIPTS 同构，本地独立维护）
# 说明：orchestrator.py 是 CLI 入口（顶层 load_config 有副作用），backend 不宜 import；
# 注册表保持与 agent 仓一致，新增 agent 时两处同步（契约：goal + --job-id + 产物带 _meta.job_id）
DEFAULT_AGENT_TYPE = "analyst"
AGENT_SCRIPTS: dict[str, Path] = {
    "analyst": SCRIPTS_PATH / "research_agent.py",
    "portfolio_risk": SCRIPTS_PATH / "portfolio_risk_agent.py",
    "decision_review": SCRIPTS_PATH / "decision_review_agent.py",
}


def resolve_agent_script(agent_type: str | None) -> Path | None:
    """agent_type → 执行脚本路径（分派纯函数，不执行）。

    - agent_type 缺省 → DEFAULT_AGENT_TYPE（老 job 向后兼容）
    - 注册表未知类型 → None（fail-closed：不静默当 analyst 跑）
    """
    return AGENT_SCRIPTS.get(agent_type or DEFAULT_AGENT_TYPE)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _ensure_jobs_dir() -> None:
    JOBS_DIR.mkdir(parents=True, exist_ok=True)


def _write_job(job: dict) -> None:
    """原子写 job 文件：先写 temp 再 os.replace。"""
    with _job_lock:
        _ensure_jobs_dir()
        tmp = JOBS_DIR / f".{job['job_id']}.tmp"
        tmp.write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, JOBS_DIR / f"{job['job_id']}.json")


def _update_job(job_id: str, **fields) -> None:
    with _job_lock:
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


def _parse_progress_line(line: str) -> dict | None:
    message = line.strip()
    match = _PROGRESS_PATTERN.match(message)
    if match:
        stage = match.group(1).lower()
    elif message.startswith("完成"):
        stage = "complete"
    else:
        return None
    return {"stage": stage, "message": message}


def _update_progress(job_id: str, stage: str, message: str) -> None:
    with _job_lock:
        job = _load_job(job_id)
        if job is None:
            return
        previous = job.get("progress") or {}
        events = list(previous.get("events") or [])
        event = {"stage": stage, "message": message, "updated_at": _now()}
        events.append(event)
        job["progress"] = {**event, "events": events[-PROGRESS_EVENT_LIMIT:]}
        _write_job(job)


def _consume_output_line(job_id: str, line: str) -> None:
    progress = _parse_progress_line(line)
    if progress:
        _update_progress(job_id, **progress)


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


def _enqueue_job(job_id: str, goal: str, agent_type: str, recovered: bool = False) -> bool:
    with _schedule_lock:
        if job_id in _scheduled_jobs:
            return False
        _scheduled_jobs.add(job_id)
    try:
        future = _executor.submit(_run_job, job_id, goal, agent_type, recovered=recovered)
    except Exception:
        with _schedule_lock:
            _scheduled_jobs.discard(job_id)
        raise

    def forget_job(_) -> None:
        with _schedule_lock:
            _scheduled_jobs.discard(job_id)

    future.add_done_callback(forget_job)
    return True


def submit_job(
    goal: str,
    category: str | None = None,
    gate: dict | None = None,
    agent_type: str | None = None,
) -> dict:
    """建 queued job 并交给有界执行器；立即返回 job 状态（调用方勿阻塞）。"""
    agent_type = agent_type or DEFAULT_AGENT_TYPE
    job_id = uuid.uuid4().hex
    job = {
        "job_id": job_id,
        "status": STATUS_QUEUED,
        "agent_type": agent_type,
        "goal": goal,
        "category": category,
        "gate": gate or {},
        "created_at": _now(),
        "started_at": None,
        "finished_at": None,
        "report_path": None,
        "error": None,
        "pid": None,
        "progress": None,
    }
    _write_job(job)
    _enqueue_job(job_id, goal, agent_type)
    return job


def recover_jobs() -> None:
    """恢复落盘的 queued/running 任务；执行器登记集合防止同进程重复入队。"""
    _ensure_jobs_dir()
    for path in JOBS_DIR.glob("*.json"):
        job = _load_job(path.stem)
        if not job or job.get("status") not in {STATUS_QUEUED, STATUS_RUNNING} or not job.get("goal"):
            continue
        _enqueue_job(
            job["job_id"],
            job["goal"],
            job.get("agent_type") or DEFAULT_AGENT_TYPE,
            recovered=True,
        )


def _windows_pid_alive(pid: int) -> bool:
    import ctypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.restype = ctypes.c_void_p
    handle = kernel32.OpenProcess(0x00100000, False, int(pid))  # SYNCHRONIZE
    if not handle:
        return False
    try:
        return kernel32.WaitForSingleObject(ctypes.c_void_p(handle), 0) == 0x00000102
    finally:
        kernel32.CloseHandle(ctypes.c_void_p(handle))


def _pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    if os.name == "nt":
        return _windows_pid_alive(int(pid))
    try:
        os.kill(int(pid), 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def _monitor_recovered_process(job_id: str, pid: int) -> None:
    """旧进程仍存活时只监控；恢复后最多再等待一个完整超时时长。"""
    deadline = time.monotonic() + SUB_TIMEOUT
    while _pid_alive(pid):
        if time.monotonic() >= deadline:
            try:
                os.kill(pid, signal.SIGTERM)
            except OSError:
                pass
            _update_job(
                job_id,
                status=STATUS_FAILED,
                finished_at=_now(),
                error=f"timeout after {SUB_TIMEOUT}s (subprocess killed)",
            )
            return
        _poll_interval()

    report_path = _find_report(job_id)
    if report_path is None:
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error="recovered subprocess exited but no report file matched job_id in data/research",
        )
        return
    _update_job(
        job_id,
        status=STATUS_DONE,
        finished_at=_now(),
        report_path=str(report_path),
        error=None,
    )


def _consume_process(proc, job_id: str) -> tuple[int, str, bool]:
    lines: queue.Queue[str | None] = queue.Queue()

    def read_output() -> None:
        for line in proc.stdout:
            lines.put(line)
        lines.put(None)

    reader = threading.Thread(target=read_output, daemon=True)
    reader.start()
    captured: list[str] = []
    deadline = time.monotonic() + SUB_TIMEOUT
    timed_out = False

    while True:
        try:
            line = lines.get(timeout=0.05)
        except queue.Empty:
            line = ""
        if line is None:
            break
        if line:
            captured.append(line)
            _consume_output_line(job_id, line)

        returncode = proc.poll()
        if returncode is not None and not reader.is_alive() and lines.empty():
            break
        if returncode is None and time.monotonic() >= deadline:
            proc.kill()
            timed_out = True

    reader.join(timeout=1)
    returncode = proc.wait()
    return returncode, "".join(captured), timed_out


def _run_job(job_id: str, goal: str, agent_type: str, recovered: bool = False) -> None:
    if recovered:
        previous = _load_job(job_id)
        if previous and previous.get("status") == STATUS_RUNNING and _pid_alive(previous.get("pid")):
            _monitor_recovered_process(job_id, previous["pid"])
            return

    _update_job(
        job_id,
        status=STATUS_RUNNING,
        started_at=_now(),
        finished_at=None,
        report_path=None,
        error=None,
        pid=None,
        progress=None,
    )

    script = resolve_agent_script(agent_type)
    if script is None:
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error=f"未知 agent_type={agent_type!r}（可用: {list(AGENT_SCRIPTS)}）",
        )
        return
    if not script.exists():
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error=f"agent_type={agent_type} 执行脚本缺失: {script.name}",
        )
        return

    py = _pick_python()
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)  # 跑批环境要求干净 PYTHONPATH
    env["PYTHONUNBUFFERED"] = "1"  # 阶段日志实时进入后端进度事件
    cmd = [py, str(script), goal, "--job-id", job_id]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=str(AGENT_DIR),
            env=env,
        )
        _update_job(job_id, pid=proc.pid)
        returncode, output_text, timed_out = _consume_process(proc, job_id)
    except OSError as exc:
        _update_job(job_id, status=STATUS_FAILED, finished_at=_now(), error=f"subprocess failed to start: {exc}")
        return

    if timed_out:
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error=f"timeout after {SUB_TIMEOUT}s (subprocess killed)",
        )
        return

    if returncode != 0:
        tail = output_text.strip()[-2000:]
        _update_job(
            job_id,
            status=STATUS_FAILED,
            finished_at=_now(),
            error=f"exit={returncode}: {tail}",
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


def get_reader_report(job_id: str) -> Path | None:
    """返回任务所属的 HTML 阅读版，禁止借报告字段跳出研究产物目录。"""
    job = _load_job(job_id)
    if not job or job.get("status") != STATUS_DONE or not job.get("report_path"):
        return None
    root = RESEARCH_OUT_DIR.resolve()
    report_path = Path(job["report_path"]).resolve()
    if report_path.parent != root or not report_path.is_file():
        return None
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    reader_name = (report.get("_meta") or {}).get("reader_report") or report_path.with_suffix(".html").name
    reader_path = (root / str(reader_name)).resolve()
    if reader_path.parent != root or reader_path.suffix.lower() != ".html":
        return None
    if not reader_path.exists():
        try:
            scripts = str(SCRIPTS_PATH)
            if scripts not in sys.path:
                sys.path.insert(0, scripts)
            from research_renderer import render_reader_html  # noqa: E402

            reader_path.write_text(render_reader_html(report), encoding="utf-8")
        except (ImportError, OSError):
            return None
    return reader_path if reader_path.is_file() else None


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
                "agent_type": data.get("agent_type") or DEFAULT_AGENT_TYPE,  # 老 job 归 analyst
                "goal": data.get("goal"),
                "category": data.get("category"),
                "created_at": data.get("created_at"),
                "finished_at": data.get("finished_at"),
                "report_path": data.get("report_path"),
                "error": data.get("error"),
                "pid": data.get("pid"),
                "progress": data.get("progress"),
            }
        )
    jobs.sort(key=lambda j: j.get("created_at") or "", reverse=True)
    return jobs[:limit]
