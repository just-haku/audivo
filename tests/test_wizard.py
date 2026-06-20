import pytest
from fastapi.testclient import TestClient

def test_wizard_check(client: TestClient, monkeypatch):
    # Mock subprocess.run for ffmpeg check
    import subprocess
    import collections
    
    def mock_subprocess_run(cmd, *args, **kwargs):
        CompletedProcess = collections.namedtuple("CompletedProcess", ["returncode", "stdout", "stderr"])
        if "ffmpeg" in cmd:
            return CompletedProcess(0, "ffmpeg version 6.0 Copyright (c) 2000-2023 the FFmpeg developers", "")
        return CompletedProcess(1, "", "")
        
    monkeypatch.setattr(subprocess, "run", mock_subprocess_run)
    
    # Mock disk usage
    import shutil
    def mock_disk_usage(path):
        # returns total, used, free (e.g. 10GB total, 5GB free)
        return (10 * 1024**3, 5 * 1024**3, 5 * 1024**3)
    monkeypatch.setattr(shutil, "disk_usage", mock_disk_usage)
    
    # Run check
    response = client.get("/api/wizard/check")
    assert response.status_code == 200
    res = response.json()
    
    assert "ffmpeg" in res
    assert res["ffmpeg"]["ok"] is True
    assert "6.0" in res["ffmpeg"]["version"]
    
    assert "disk_space" in res
    assert res["disk_space"]["ok"] is True
    assert res["disk_space"]["free_gb"] == 5.0

def test_webgpu_probe_and_manifest(client: TestClient):
    # Test POST probe results
    probe_payload = {
        "supported": True,
        "vendor": "Intel",
        "architecture": "Gen12",
        "maxBufferSize": 1000000,
        "maxComputeWorkgroupSizeX": 256
    }
    response = client.post("/api/webgpu/probe-results", json=probe_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # Test GET model manifest
    response = client.get("/api/models/manifest")
    assert response.status_code == 200
    manifest = response.json()
    assert "models" in manifest
    assert len(manifest["models"]) == 3
    assert any(m["id"] == "vieneu_onnx" for m in manifest["models"])
    assert any(m["id"] == "faster_whisper" for m in manifest["models"])

def test_download_model_endpoint(client: TestClient, monkeypatch):
    called_repo = []
    called_files = []

    def mock_hf_hub_download(repo_id, filename, **kwargs):
        called_repo.append(repo_id)
        called_files.append(filename)
        return "/tmp/mock_file"

    import shutil
    def mock_copy2(src, dst):
        pass

    monkeypatch.setattr("huggingface_hub.hf_hub_download", mock_hf_hub_download)
    monkeypatch.setattr(shutil, "copy2", mock_copy2)

    # 1. Test when version is v2
    monkeypatch.setattr("backend.config.load_config", lambda: {"vieneu_version": "v2"})

    response = client.post("/api/models/download", json={"model_id": "vieneu_onnx"})
    assert response.status_code == 200
    assert "v2" in response.json()["path"]
    assert "pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF" in called_repo

    # 2. Test when version is v3
    called_repo.clear()
    called_files.clear()
    monkeypatch.setattr("backend.config.load_config", lambda: {"vieneu_version": "v3"})

    response = client.post("/api/models/download", json={"model_id": "vieneu_onnx"})
    assert response.status_code == 200
    assert "onnx" in response.json()["path"]
    assert "pnnbao-ump/VieNeu-TTS-v3-Turbo" in called_repo

