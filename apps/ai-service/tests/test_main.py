from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_local_fallback() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["provider"] == "local-rule-based"


def test_analysis_requires_human_approval() -> None:
    response = client.post(
        "/analyze",
        json={
            "incident_id": "demo-1",
            "title": "Water reported on road",
            "description": "Water is deep near the junction; please verify.",
            "category": "WATERLOGGING",
        },
    )
    assert response.status_code == 200
    assert response.json()["approval_required"] is True
    assert response.json()["provider"] == "local-rule-based"
    assert response.json()["severity_indicators"]
