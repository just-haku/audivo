import os
import sqlite3
import json
import time
import uuid
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.media_db import MEDIA_DB_PATH
from backend.jobs import JobManager, JobType
from backend.routers.generation import GenerateRequest, run_generation_pipeline

router = APIRouter(tags=["projects"])
job_manager = JobManager()

class ProjectData(BaseModel):
    name: str
    script: str
    default_voice: str
    video_materials: list[str]
    bg_music: list[str]
    settings: dict[str, Any]
    subtitle_cues: list[dict[str, Any]] | None = None
    generated_videos: list[str] | None = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    script: str
    default_voice: str
    video_materials: list[str]
    bg_music: list[str]
    settings: dict[str, Any]
    subtitle_cues: list[dict[str, Any]]
    generated_videos: list[str]
    created_at: float
    updated_at: float

@router.post("/api/projects")
async def create_project(req: ProjectData):
    project_id = str(uuid.uuid4())
    now = time.time()
    
    video_materials_json = json.dumps(req.video_materials)
    bg_music_json = json.dumps(req.bg_music)
    settings_json = json.dumps(req.settings)
    subtitle_cues_json = json.dumps(req.subtitle_cues or [])
    generated_videos_json = json.dumps(req.generated_videos or [])
    
    try:
        conn = sqlite3.connect(MEDIA_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO projects (id, name, script, default_voice, video_materials, bg_music, settings, subtitle_cues, generated_videos, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (project_id, req.name, req.script, req.default_voice, video_materials_json, bg_music_json, settings_json, subtitle_cues_json, generated_videos_json, now, now))
        conn.commit()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {e}")
        
    return {"status": "ok", "id": project_id}

@router.get("/api/projects")
async def list_projects():
    try:
        conn = sqlite3.connect(MEDIA_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, created_at, updated_at FROM projects ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {e}")

@router.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    try:
        conn = sqlite3.connect(MEDIA_DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        row = cursor.fetchone()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query project: {e}")
        
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
        
    res = dict(row)
    res["video_materials"] = json.loads(res["video_materials"])
    res["bg_music"] = json.loads(res["bg_music"])
    res["settings"] = json.loads(res["settings"])
    res["subtitle_cues"] = json.loads(res["subtitle_cues"])
    res["generated_videos"] = json.loads(res["generated_videos"])
    return res

@router.put("/api/projects/{project_id}")
async def update_project(project_id: str, req: ProjectData):
    now = time.time()
    video_materials_json = json.dumps(req.video_materials)
    bg_music_json = json.dumps(req.bg_music)
    settings_json = json.dumps(req.settings)
    subtitle_cues_json = json.dumps(req.subtitle_cues or [])
    generated_videos_json = json.dumps(req.generated_videos or [])
    
    try:
        conn = sqlite3.connect(MEDIA_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Project not found")
            
        cursor.execute("""
            UPDATE projects SET name = ?, script = ?, default_voice = ?, video_materials = ?, bg_music = ?, settings = ?, subtitle_cues = ?, generated_videos = ?, updated_at = ?
            WHERE id = ?
        """, (req.name, req.script, req.default_voice, video_materials_json, bg_music_json, settings_json, subtitle_cues_json, generated_videos_json, now, project_id))
        conn.commit()
        conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {e}")
        
    return {"status": "ok"}

@router.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    try:
        conn = sqlite3.connect(MEDIA_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Project not found")
            
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        conn.close()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {e}")
        
    return {"status": "ok"}

@router.post("/api/projects/{project_id}/generate")
async def generate_project(project_id: str):
    project = await get_project(project_id)
    
    payload = {
        "script": project["script"],
        "default_voice": project["default_voice"],
        "video_materials": project["video_materials"],
        "bg_music": project["bg_music"],
        "bg_music_volume": project["settings"].get("bg_music_volume", 0.2),
        "video_speed": project["settings"].get("video_speed", 1.0),
        "aspect_ratio": project["settings"].get("aspect_ratio", "9:16"),
        "mute_video": project["settings"].get("mute_video", True),
        "video_order_mode": project["settings"].get("video_order_mode", "ordered"),
        "vieneu_batch_paragraphs": project["settings"].get("vieneu_batch_paragraphs", 1),
        "asr_provider": project["settings"].get("asr_provider"),
        "subtitle_timing_source": project["settings"].get("subtitle_timing_source", "asr"),
        "subtitle_fallback_to_estimated": project["settings"].get("subtitle_fallback_to_estimated", True),
        "review_subtitles": project["settings"].get("review_subtitles", False),
        
        "subtitle_font": project["settings"].get("subtitle_font", "Arial"),
        "subtitle_font_size": project["settings"].get("subtitle_font_size", 48),
        "subtitle_color": project["settings"].get("subtitle_color", "#FFFFFF"),
        "subtitle_outline_color": project["settings"].get("subtitle_outline_color", "#000000"),
        "subtitle_outline_width": project["settings"].get("subtitle_outline_width", 3),
        "subtitle_back_color": project["settings"].get("subtitle_back_color", "#000000"),
        "subtitle_shadow_depth": project["settings"].get("subtitle_shadow_depth", 0),
        "subtitle_bold": project["settings"].get("subtitle_bold", True),
        "subtitle_italic": project["settings"].get("subtitle_italic", False),
        "subtitle_margin_v": project["settings"].get("subtitle_margin_v", 180),
        
        "intro_template": project["settings"].get("intro_template"),
        "outro_template": project["settings"].get("outro_template"),
        "watermark_path": project["settings"].get("watermark_path"),
        "watermark_position": project["settings"].get("watermark_position", "bottom-right"),
        "watermark_opacity": project["settings"].get("watermark_opacity", 0.7)
    }
    
    try:
        req = GenerateRequest(**payload)
        job_id = job_manager.create_job(JobType.GENERATION, req.model_dump())
        job_manager.start_job(job_id, run_generation_pipeline, req)
        return {"status": "started", "job_id": job_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger project generation: {e}")
