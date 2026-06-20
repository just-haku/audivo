import pytest
from fastapi.testclient import TestClient

def test_project_crud_and_generation(client: TestClient, monkeypatch):
    # 1. Create project
    proj_data = {
        "name": "Test Project",
        "script": "Hello test world.",
        "default_voice": "en-US-Neural2-F",
        "video_materials": ["clip1.mp4"],
        "bg_music": [],
        "settings": {
            "aspect_ratio": "16:9",
            "video_speed": 1.0
        }
    }
    
    response = client.post("/api/projects", json=proj_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["status"] == "ok"
    proj_id = res_json["id"]
    assert proj_id is not None
    
    # 2. List projects
    response = client.get("/api/projects")
    assert response.status_code == 200
    projects_list = response.json()
    assert len(projects_list) > 0
    assert any(p["id"] == proj_id for p in projects_list)
    
    # 3. Get project
    response = client.get(f"/api/projects/{proj_id}")
    assert response.status_code == 200
    proj = response.json()
    assert proj["name"] == "Test Project"
    assert proj["script"] == "Hello test world."
    assert proj["settings"]["aspect_ratio"] == "16:9"
    
    # 4. Update project
    proj_data["name"] = "Updated Project Name"
    response = client.put(f"/api/projects/{proj_id}", json=proj_data)
    assert response.status_code == 200
    
    response = client.get(f"/api/projects/{proj_id}")
    assert response.json()["name"] == "Updated Project Name"
    
    # 5. Generate project video (mock the generation pipeline run)
    from backend.routers import projects
    generation_triggered = False
    
    def mock_start_job(self, job_id, target_fn, *args, **kwargs):
        nonlocal generation_triggered
        generation_triggered = True
        
    monkeypatch.setattr(projects.job_manager, "start_job", mock_start_job)
    
    response = client.post(f"/api/projects/{proj_id}/generate")
    assert response.status_code == 200
    assert "job_id" in response.json()
    assert generation_triggered is True
    
    # 6. Delete project
    response = client.delete(f"/api/projects/{proj_id}")
    assert response.status_code == 200
    
    response = client.get(f"/api/projects/{proj_id}")
    assert response.status_code == 404
