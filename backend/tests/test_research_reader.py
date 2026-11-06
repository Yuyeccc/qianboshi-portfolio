import json

from fastapi.testclient import TestClient

from app import main, research_service


def _make_report(tmp_path, monkeypatch, reader_name="report.html"):
    jobs_dir = tmp_path / "jobs"
    out_dir = tmp_path / "research"
    jobs_dir.mkdir()
    out_dir.mkdir()
    monkeypatch.setattr(research_service, "JOBS_DIR", jobs_dir)
    monkeypatch.setattr(research_service, "RESEARCH_OUT_DIR", out_dir)
    report_path = out_dir / "report.json"
    meta = {"job_id": "job-1"}
    if reader_name is not None:
        meta["reader_report"] = reader_name
    report_path.write_text(json.dumps({"goal": "历史研究", "_meta": meta}), encoding="utf-8")
    (jobs_dir / "job-1.json").write_text(json.dumps({
        "job_id": "job-1", "status": "done", "report_path": str(report_path)
    }), encoding="utf-8")
    return out_dir


def test_get_reader_report_returns_html_owned_by_job(tmp_path, monkeypatch):
    out_dir = _make_report(tmp_path, monkeypatch)
    html = out_dir / "report.html"
    html.write_text("<h1>阅读版</h1>", encoding="utf-8")
    assert research_service.get_reader_report("job-1") == html


def test_get_reader_report_generates_html_for_legacy_json(tmp_path, monkeypatch):
    out_dir = _make_report(tmp_path, monkeypatch, reader_name=None)
    reader = research_service.get_reader_report("job-1")
    assert reader == out_dir / "report.html"
    assert reader.exists()
    assert "历史研究" in reader.read_text(encoding="utf-8")


def test_get_reader_report_rejects_missing_and_escape_paths(tmp_path, monkeypatch):
    out_dir = _make_report(tmp_path, monkeypatch, "../escape.html")
    assert research_service.get_reader_report("job-1") is None
    assert research_service.get_reader_report("missing") is None


def test_reader_route_returns_html_and_404(tmp_path, monkeypatch):
    html = tmp_path / "report.html"
    html.write_text("<h1>阅读版</h1>", encoding="utf-8")
    monkeypatch.setattr(main, "get_reader_report", lambda job_id: html if job_id == "job-1" else None)
    client = TestClient(main.app)
    response = client.get("/api/v1/research/jobs/job-1/reader")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "阅读版" in response.text
    assert client.get("/api/v1/research/jobs/missing/reader").status_code == 404
