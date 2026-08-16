import os

os.environ.setdefault("SUPERBROWSER_SESSION_TOKEN", "test-token")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to SuperBrowser API"}


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["service"] == "SuperBrowser API"


def test_ai_search_endpoint():
    response = client.get(
        "/api/search/ai",
        params={"q": "test query"},
        headers={"X-Session-Token": os.environ["SUPERBROWSER_SESSION_TOKEN"]},
    )
    assert response.status_code == 200
    assert "answer" in response.json()