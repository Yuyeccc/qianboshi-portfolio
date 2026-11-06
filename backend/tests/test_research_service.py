import io
import json
import queue
import sys
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app import main, research_service


def _isolate_dirs(tmp_path, monkeypatch):
    jobs_dir = tmp_path / "jobs"
    out_dir = tmp_path / "research"
    jobs_dir.mkdir()
    out_dir.mkdir()
    monkeypatch.setattr(research_service, "JOBS_DIR", jobs_dir)
    monkeypatch.setattr(research_service, "RESEARCH_OUT_DIR", out_dir)
    return jobs_dir, out_dir


def _persist_job(jobs_dir, job_id, status="queued", **fields):
    job = {
        "job_id": job_id,
        "status": status,
        "agent_type": "analyst",
        "goal": f"goal-{job_id}",
        "created_at": "2026-01-01T00:00:00",
        "started_at": None,
        "finished_at": None,
        "report_path": None,
        "error": None,
        "pid": None,
    }
    job.update(fields)
    (jobs_dir / f"{job_id}.json").write_text(json.dumps(job), encoding="utf-8")
    return job


class _RecordingExecutor:
    def __init__(self):
        self.calls = []

    def submit(self, fn, *args, **kwargs):
        self.calls.append((fn, args, kwargs))
        return Future()


class _FakeProcess:
    def __init__(self, output, lines=(), returncode=0, never_finish=False):
        self.pid = 4321
        self.returncode = None if never_finish else returncode
        self.killed = False
        self.waited = False
        self.stdout = io.StringIO("".join(line + "\n" for line in lines))

    def poll(self):
        return self.returncode

    def kill(self):
        self.killed = True
        self.returncode = -9

    def wait(self):
        self.waited = True
        return self.returncode


def _reject_legacy_run(*args, **kwargs):
    raise AssertionError("子进程必须通过 Popen 启动")


def test_executor_defaults_to_two_workers_and_honors_env(monkeypatch):
    assert hasattr(research_service, "_create_executor")
    monkeypatch.delenv("QIANBOSHI_RESEARCH_MAX_WORKERS", raising=False)
    executor = research_service._create_executor()
    try:
        assert executor._max_workers == 2
    finally:
        executor.shutdown(wait=True)

    monkeypatch.setenv("QIANBOSHI_RESEARCH_MAX_WORKERS", "3")
    executor = research_service._create_executor()
    try:
        assert executor._max_workers == 3
    finally:
        executor.shutdown(wait=True)


def test_submit_job_never_exceeds_executor_capacity(tmp_path, monkeypatch):
    _isolate_dirs(tmp_path, monkeypatch)
    assert hasattr(research_service, "_executor")
    executor = ThreadPoolExecutor(max_workers=2)
    monkeypatch.setattr(research_service, "_executor", executor)
    monkeypatch.setattr(research_service, "_scheduled_jobs", set())

    started = queue.Queue()
    release = threading.Event()
    finished = threading.Event()
    state_lock = threading.Lock()
    state = {"active": 0, "max_active": 0, "finished": 0}

    def blocking_run(job_id, goal, agent_type, recovered=False):
        with state_lock:
            state["active"] += 1
            state["max_active"] = max(state["max_active"], state["active"])
        started.put(job_id)
        release.wait(timeout=3)
        with state_lock:
            state["active"] -= 1
            state["finished"] += 1
            if state["finished"] == 3:
                finished.set()

    monkeypatch.setattr(research_service, "_run_job", blocking_run)
    try:
        jobs = [research_service.submit_job(f"goal-{index}") for index in range(3)]
        assert {started.get(timeout=1), started.get(timeout=1)} == {
            jobs[0]["job_id"],
            jobs[1]["job_id"],
        }
        with pytest.raises(queue.Empty):
            started.get(timeout=0.1)
        assert research_service._load_job(jobs[2]["job_id"])["status"] == "queued"
    finally:
        release.set()
        assert finished.wait(timeout=3)
        executor.shutdown(wait=True)

    assert state["max_active"] == 2
    assert started.get_nowait() == jobs[2]["job_id"]


def test_recover_jobs_restores_queued_and_running_once(tmp_path, monkeypatch):
    jobs_dir, _ = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "queued-job", status="queued")
    _persist_job(jobs_dir, "running-job", status="running", pid=1234)
    _persist_job(jobs_dir, "done-job", status="done")
    executor = _RecordingExecutor()
    monkeypatch.setattr(research_service, "_executor", executor, raising=False)
    monkeypatch.setattr(research_service, "_scheduled_jobs", set(), raising=False)

    assert hasattr(research_service, "recover_jobs")
    research_service.recover_jobs()
    first_calls = list(executor.calls)
    research_service.recover_jobs()

    assert executor.calls == first_calls
    recovered = {call[1][0]: call for call in first_calls}
    assert set(recovered) == {"queued-job", "running-job"}
    assert recovered["queued-job"][1][1:] == ("goal-queued-job", "analyst")
    assert recovered["running-job"][1][1:] == ("goal-running-job", "analyst")
    assert all(call[2] == {"recovered": True} for call in first_calls)


def test_recovered_running_job_with_live_pid_only_monitors(tmp_path, monkeypatch):
    jobs_dir, _ = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "live-job", status="running", pid=1234)
    monitored = []
    monkeypatch.setattr(research_service, "_pid_alive", lambda pid: True, raising=False)
    monkeypatch.setattr(
        research_service,
        "_monitor_recovered_process",
        lambda job_id, pid: monitored.append((job_id, pid)),
        raising=False,
    )
    monkeypatch.setattr(research_service.subprocess, "Popen", _reject_legacy_run, raising=False)

    research_service._run_job("live-job", "goal-live-job", "analyst", recovered=True)

    assert monitored == [("live-job", 1234)]


@pytest.mark.parametrize(
    "initial_status,recovered",
    [("queued", False), ("queued", True), ("running", True)],
)
def test_popen_rerun_persists_pid_progress_and_exact_report(
    tmp_path, monkeypatch, initial_status, recovered
):
    jobs_dir, out_dir = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "job-1", status=initial_status, pid=999 if recovered else None)
    script = tmp_path / "research_agent.py"
    script.write_text("# test double\n", encoding="utf-8")
    report_path = out_dir / "report.json"
    report_path.write_text(
        json.dumps({"result": "ok", "_meta": {"job_id": "job-1"}}), encoding="utf-8"
    )
    processes = []

    def popen(cmd, **kwargs):
        process = _FakeProcess(
            kwargs["stdout"],
            lines=["[1/6] 提取检索要素", "[5c/6] Critic 核查", "完成，耗时 3s"],
        )
        processes.append((process, cmd, kwargs))
        return process

    monkeypatch.setattr(research_service, "resolve_agent_script", lambda agent_type: script)
    monkeypatch.setattr(research_service, "_pick_python", lambda: sys.executable)
    monkeypatch.setattr(research_service, "_pid_alive", lambda pid: False, raising=False)
    monkeypatch.setattr(research_service.subprocess, "Popen", popen, raising=False)
    monkeypatch.setattr(research_service.subprocess, "run", _reject_legacy_run)

    research_service._run_job("job-1", "goal-job-1", "analyst", recovered=recovered)

    job = research_service.get_job("job-1")
    assert job["status"] == "done"
    assert job["pid"] == 4321
    assert job["report_path"] == str(report_path)
    assert job["report"]["result"] == "ok"
    assert job["error"] is None
    assert [event["stage"] for event in job["progress"]["events"]] == [
        "1/6",
        "5c/6",
        "complete",
    ]
    assert job["progress"]["stage"] == "complete"
    assert job["progress"]["message"] == "完成，耗时 3s"
    assert job["progress"]["updated_at"]
    assert "percent" not in job["progress"]
    assert len(processes) == 1
    assert processes[0][1][:2] == [sys.executable, str(script)]
    assert processes[0][2]["stderr"] == research_service.subprocess.STDOUT
    assert processes[0][2]["env"]["PYTHONUNBUFFERED"] == "1"

    response = TestClient(main.app).get("/api/v1/research/jobs/job-1")
    assert response.status_code == 200
    assert response.json()["job"]["progress"] == job["progress"]
    assert response.json()["job"]["pid"] == 4321


def test_real_subprocess_streams_progress_without_corrupting_output(tmp_path, monkeypatch):
    jobs_dir, out_dir = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "real-job")
    script = tmp_path / "research_agent.py"
    script.write_text(
        "import json, os, sys, time\n"
        "from pathlib import Path\n"
        "job_id = sys.argv[sys.argv.index('--job-id') + 1]\n"
        "print('[1/6] 提取检索要素', flush=True)\n"
        "time.sleep(0.1)\n"
        "print('[5/6] 组装研究报告', flush=True)\n"
        "report = {'result': 'ok', '_meta': {'job_id': job_id}}\n"
        "path = Path(os.environ['TEST_RESEARCH_OUT']) / 'real.json'\n"
        "path.write_text(json.dumps(report), encoding='utf-8')\n"
        "print('完成，耗时 1s', flush=True)\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("TEST_RESEARCH_OUT", str(out_dir))
    monkeypatch.setattr(research_service, "resolve_agent_script", lambda agent_type: script)
    monkeypatch.setattr(research_service, "_pick_python", lambda: sys.executable)

    research_service._run_job("real-job", "goal-real-job", "analyst")

    job = research_service.get_job("real-job")
    assert job["status"] == "done"
    assert job["report"]["result"] == "ok"
    assert [event["stage"] for event in job["progress"]["events"]] == [
        "1/6", "5/6", "complete"
    ]


def test_progress_parser_ignores_unmarked_output_and_bounds_events(tmp_path, monkeypatch):
    jobs_dir, _ = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "job-1")
    assert hasattr(research_service, "_parse_progress_line")
    assert research_service._parse_progress_line("ordinary log") is None
    assert research_service._parse_progress_line("[1/6] 提取") == {
        "stage": "1/6",
        "message": "[1/6] 提取",
    }
    assert research_service._parse_progress_line("完成，耗时 3s") == {
        "stage": "complete",
        "message": "完成，耗时 3s",
    }

    for index in range(25):
        research_service._update_progress("job-1", f"stage-{index}", f"message-{index}")

    progress = research_service.get_job("job-1")["progress"]
    assert len(progress["events"]) == 20
    assert progress["events"][0]["message"] == "message-5"
    assert progress["events"][-1]["message"] == "message-24"
    assert progress["stage"] == "stage-24"
    assert progress["message"] == "message-24"


def test_popen_timeout_kills_process_and_preserves_failure(tmp_path, monkeypatch):
    jobs_dir, _ = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "timeout-job")
    script = tmp_path / "research_agent.py"
    script.write_text("# test double\n", encoding="utf-8")
    processes = []

    def popen(cmd, **kwargs):
        process = _FakeProcess(kwargs["stdout"], lines=["[1/6] 等待"], never_finish=True)
        processes.append(process)
        return process

    monkeypatch.setattr(research_service, "SUB_TIMEOUT", 0)
    monkeypatch.setattr(research_service, "resolve_agent_script", lambda agent_type: script)
    monkeypatch.setattr(research_service.subprocess, "Popen", popen, raising=False)
    monkeypatch.setattr(research_service.subprocess, "run", _reject_legacy_run)

    research_service._run_job("timeout-job", "goal-timeout-job", "analyst")

    job = research_service.get_job("timeout-job")
    assert job["status"] == "failed"
    assert job["error"] == "timeout after 0s (subprocess killed)"
    assert job["finished_at"]
    assert job["pid"] == 4321
    assert job["progress"]["stage"] == "1/6"
    assert processes[0].killed is True
    assert processes[0].waited is True


def test_popen_nonzero_exit_keeps_error_output(tmp_path, monkeypatch):
    jobs_dir, _ = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "failed-job")
    script = tmp_path / "research_agent.py"
    script.write_text("# test double\n", encoding="utf-8")

    def popen(cmd, **kwargs):
        return _FakeProcess(kwargs["stdout"], lines=["[1/6] 开始", "boom"], returncode=7)

    monkeypatch.setattr(research_service, "resolve_agent_script", lambda agent_type: script)
    monkeypatch.setattr(research_service.subprocess, "Popen", popen, raising=False)
    monkeypatch.setattr(research_service.subprocess, "run", _reject_legacy_run)

    research_service._run_job("failed-job", "goal-failed-job", "analyst")

    job = research_service.get_job("failed-job")
    assert job["status"] == "failed"
    assert job["error"].startswith("exit=7: ")
    assert "boom" in job["error"]
    assert job["finished_at"]
    assert job["report_path"] is None


def test_windows_pid_liveness_does_not_use_os_kill(monkeypatch):
    monkeypatch.setattr(research_service.os, "name", "nt")
    monkeypatch.setattr(research_service, "_windows_pid_alive", lambda pid: True, raising=False)

    def forbidden_kill(pid, sig):
        raise AssertionError("Windows 存活检查不得调用 os.kill")

    monkeypatch.setattr(research_service.os, "kill", forbidden_kill)
    assert research_service._pid_alive(1234) is True


def test_monitor_recovered_process_finishes_with_exact_report(tmp_path, monkeypatch):
    jobs_dir, out_dir = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "live-job", status="running", pid=1234)
    report_path = out_dir / "report.json"
    report_path.write_text(json.dumps({"_meta": {"job_id": "live-job"}}), encoding="utf-8")
    monkeypatch.setattr(research_service, "_pid_alive", lambda pid: False, raising=False)
    monkeypatch.setattr(research_service, "_poll_interval", lambda: None, raising=False)

    research_service._monitor_recovered_process("live-job", 1234)

    job = research_service.get_job("live-job")
    assert job["status"] == "done"
    assert job["report_path"] == str(report_path)
    assert job["pid"] == 1234


def test_job_updates_are_serialized_without_losing_progress(tmp_path, monkeypatch):
    jobs_dir, _ = _isolate_dirs(tmp_path, monkeypatch)
    _persist_job(jobs_dir, "job-1")
    original_write = research_service._write_job
    progress_write_started = threading.Event()
    finish_progress_write = threading.Event()

    def slow_progress_write(job):
        if job.get("progress") and not progress_write_started.is_set():
            progress_write_started.set()
            assert finish_progress_write.wait(timeout=2)
        original_write(job)

    monkeypatch.setattr(research_service, "_write_job", slow_progress_write)
    progress = {"stage": "1/6", "message": "working", "updated_at": "now", "events": []}
    first = threading.Thread(
        target=research_service._update_job,
        args=("job-1",),
        kwargs={"progress": progress},
    )
    second = threading.Thread(
        target=research_service._update_job,
        args=("job-1",),
        kwargs={"status": "done", "finished_at": "later"},
    )
    first.start()
    assert progress_write_started.wait(timeout=1)
    second.start()
    time.sleep(0.05)
    finish_progress_write.set()
    first.join(timeout=2)
    second.join(timeout=2)

    assert not first.is_alive()
    assert not second.is_alive()
    job = research_service.get_job("job-1")
    assert job["status"] == "done"
    assert job["finished_at"] == "later"
    assert job["progress"] == progress


def test_fastapi_lifespan_recovers_jobs_only_when_started(monkeypatch):
    recovered = []
    monkeypatch.setattr(main, "recover_jobs", lambda: recovered.append(True), raising=False)

    assert recovered == []
    with TestClient(main.app):
        pass

    assert recovered == [True]
