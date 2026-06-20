import os
import subprocess
import pytest
from backend.templates import (
    get_intro_templates,
    get_outro_templates,
    apply_intro,
    apply_outro,
    apply_watermark,
    INTROS_DIR,
    OUTROS_DIR,
)

def test_get_templates_empty(tmp_path, monkeypatch):
    # Mock templates directories to use a temp path
    monkeypatch.setattr("backend.templates.INTROS_DIR", str(tmp_path / "intros"))
    monkeypatch.setattr("backend.templates.OUTROS_DIR", str(tmp_path / "outros"))
    
    assert get_intro_templates() == []
    assert get_outro_templates() == []

def test_get_templates_with_files(tmp_path, monkeypatch):
    intros_dir = tmp_path / "intros"
    outros_dir = tmp_path / "outros"
    os.makedirs(intros_dir, exist_ok=True)
    os.makedirs(outros_dir, exist_ok=True)
    
    # Create some dummy files
    (intros_dir / "intro1.mp4").write_text("intro1")
    (intros_dir / "readme.txt").write_text("readme")
    (outros_dir / "outro1.mov").write_text("outro1")
    
    monkeypatch.setattr("backend.templates.INTROS_DIR", str(intros_dir))
    monkeypatch.setattr("backend.templates.OUTROS_DIR", str(outros_dir))
    
    assert get_intro_templates() == ["intro1.mp4"]
    assert get_outro_templates() == ["outro1.mov"]

def test_apply_intro_missing_file():
    # If intro doesn't exist, should return the input video_path
    video_path = "dummy_video.mp4"
    res = apply_intro(video_path, "nonexistent_intro.mp4")
    assert res == video_path

def test_apply_outro_missing_file():
    video_path = "dummy_video.mp4"
    res = apply_outro(video_path, "nonexistent_outro.mp4")
    assert res == video_path

def test_apply_watermark_missing_file():
    video_path = "dummy_video.mp4"
    res = apply_watermark(video_path, "nonexistent_watermark.png")
    assert res == video_path

def test_apply_intro_success(tmp_path, monkeypatch):
    intros_dir = tmp_path / "intros"
    os.makedirs(intros_dir, exist_ok=True)
    (intros_dir / "my_intro.mp4").write_text("intro")
    monkeypatch.setattr("backend.templates.INTROS_DIR", str(intros_dir))
    
    video_file = tmp_path / "video.mp4"
    video_file.write_text("video")
    
    cmd_run = None
    def mock_subprocess_run(cmd, *args, **kwargs):
        nonlocal cmd_run
        cmd_run = cmd
        # Create output file to simulate successful conversion
        out_path = str(video_file).replace(".mp4", "_intro.mp4")
        with open(out_path, "w") as f:
            f.write("video_with_intro")
        import collections
        CompletedProcess = collections.namedtuple("CompletedProcess", ["returncode", "stdout", "stderr"])
        return CompletedProcess(0, "", "")
        
    monkeypatch.setattr(subprocess, "run", mock_subprocess_run)
    
    res = apply_intro(str(video_file), "my_intro.mp4")
    assert res == str(video_file).replace(".mp4", "_intro.mp4")
    assert cmd_run is not None
    assert any("concat=n=2" in arg for arg in cmd_run)

def test_apply_watermark_success(tmp_path, monkeypatch):
    fonts_dir = tmp_path / "fonts"
    os.makedirs(fonts_dir, exist_ok=True)
    (fonts_dir / "logo.png").write_text("logo")
    monkeypatch.setattr("backend.templates.DOWNLOADS_DIR", str(tmp_path))
    
    video_file = tmp_path / "video.mp4"
    video_file.write_text("video")
    
    cmd_run = None
    def mock_subprocess_run(cmd, *args, **kwargs):
        nonlocal cmd_run
        cmd_run = cmd
        out_path = str(video_file).replace(".mp4", "_watermark.mp4")
        with open(out_path, "w") as f:
            f.write("watermarked_video")
        import collections
        CompletedProcess = collections.namedtuple("CompletedProcess", ["returncode", "stdout", "stderr"])
        return CompletedProcess(0, "", "")
        
    monkeypatch.setattr(subprocess, "run", mock_subprocess_run)
    
    res = apply_watermark(str(video_file), "logo.png", position="top-left", opacity=0.5)
    assert res == str(video_file).replace(".mp4", "_watermark.mp4")
    assert cmd_run is not None
    assert any("overlay=10:10" in arg for arg in cmd_run)
    assert any("colorchannelmixer=aa=0.5" in arg for arg in cmd_run)
