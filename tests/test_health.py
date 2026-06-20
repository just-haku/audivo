import pytest
from fastapi.testclient import TestClient

def test_app_health(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "uptime_seconds" in data
    assert data["database"]["connected"] is True

def test_check_providers_all(client: TestClient, monkeypatch):
    # Mock check_all_providers to avoid real HTTP requests to external services
    from backend.routers import health
    monkeypatch.setattr(health, "check_all_providers", lambda config, creds: {
        "fish_speech": {"status": "ok", "error": None},
        "omnivoice": {"status": "ok", "error": None},
        "google_tts": {"status": "ok", "error": None}
    })
    
    response = client.get("/api/health/providers")
    assert response.status_code == 200
    data = response.json()
    assert data["fish_speech"]["status"] == "ok"

def test_check_individual_provider(client: TestClient, monkeypatch):
    # Mock individual check function
    from backend.routers import health
    monkeypatch.setattr(health, "check_fish_speech", lambda config: {"status": "error", "error": "Timeout"})
    
    response = client.get("/api/health/providers/fish_speech")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "error"
    assert data["error"] == "Timeout"

def test_check_invalid_provider(client: TestClient):
    response = client.get("/api/health/providers/invalid_one")
    assert response.status_code == 400
    assert "Unknown provider" in response.json()["detail"]
