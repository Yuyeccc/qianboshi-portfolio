from fastapi.testclient import TestClient

from app import main


def test_thesis_routes_list_filter_history_and_404(monkeypatch):
    thesis = {"thesis_id": "th_gold", "asset_ids": ["GOLD"], "status": "unchanged"}
    history = [{"thesis_id": "th_gold", "research_id": "research_1", "evidence": []}]
    calls = []

    def list_theses(asset_id=None):
        calls.append(asset_id)
        return [thesis]

    monkeypatch.setattr(main, "get_theses_data", list_theses)
    monkeypatch.setattr(
        main,
        "get_thesis_history_data",
        lambda thesis_id: history if thesis_id == "th_gold" else None,
    )
    client = TestClient(main.app)

    response = client.get("/api/v1/theses", params={"asset_id": "GOLD"})
    assert response.status_code == 200
    assert response.json() == {"theses": [thesis]}
    assert calls == ["GOLD"]

    response = client.get("/api/v1/theses/th_gold/history")
    assert response.status_code == 200
    assert response.json() == {"history": history}
    assert client.get("/api/v1/theses/missing/history").status_code == 404
