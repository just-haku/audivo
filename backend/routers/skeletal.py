import os
import shutil
import io
import json
import base64
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.skeletal_db import SkeletalDB
from backend.skeletal.renderer import SkeletalRenderer
from backend.config import DOWNLOADS_DIR

router = APIRouter(prefix="/api/skeletal", tags=["skeletal"])
db = SkeletalDB()

# Setup uploads directory path
UPLOADS_DIR = os.path.join(DOWNLOADS_DIR, "..", "storage", "uploads")
if not os.path.exists(UPLOADS_DIR):
    UPLOADS_DIR = os.path.join(DOWNLOADS_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

class CharacterSaveRequest(BaseModel):
    id: str
    name: str
    rig_data: dict

class AnimationSaveRequest(BaseModel):
    id: str
    name: str
    character_id: str
    keyframe_data: dict

class PreviewRenderRequest(BaseModel):
    bones: list[dict]
    pose_adjustments: dict
    draw_skeleton: bool = False

@router.get("/presets")
def get_presets():
    """Retrieve all built-in default animation actions."""
    preset_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "preset_actions.json")
    if os.path.exists(preset_path):
        try:
            with open(preset_path, "r") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to load preset actions: {e}")
    return {}

@router.get("/characters")
def list_characters():
    """List all character profiles."""
    return db.list_characters()

@router.get("/character/{char_id}")
def get_character(char_id: str):
    """Get details of a single character profile."""
    char = db.get_character(char_id)
    if not char:
        raise HTTPException(status_code=404, detail=f"Character {char_id} not found.")
    return char

@router.post("/character")
def save_character(req: CharacterSaveRequest):
    """Create or update a character profile."""
    success = db.save_character(req.id, req.name, req.rig_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save character profile.")
    return {"status": "success", "id": req.id}

@router.delete("/character/{char_id}")
def delete_character(char_id: str):
    """Delete a character profile."""
    success = db.delete_character(char_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete character.")
    return {"status": "success"}

@router.post("/upload")
async def upload_part(file: UploadFile = File(...)):
    """Upload a character part/limb sprite."""
    # Sanitize name
    filename = os.path.basename(file.filename)
    dest_path = os.path.join(UPLOADS_DIR, filename)
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"status": "success", "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded part: {e}")

@router.get("/animations")
def list_animations(character_id: str = None):
    """List custom animations, optionally filtered by character ID."""
    return db.list_animations(character_id)

@router.post("/animation")
def save_animation(req: AnimationSaveRequest):
    """Save custom skeletal animation keyframe tracks."""
    success = db.save_animation(req.id, req.name, req.character_id, req.keyframe_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save animation track.")
    return {"status": "success", "id": req.id}

@router.delete("/animation/{anim_id}")
def delete_animation(anim_id: str):
    """Delete a custom animation track."""
    success = db.delete_animation(anim_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete animation.")
    return {"status": "success"}

@router.post("/render-preview")
def render_preview(req: PreviewRenderRequest):
    """Render a skeletal frame preview and return it as a streaming PNG image."""
    try:
        # Solve matrices and composite the frame in memory
        img = SkeletalRenderer.render_frame(
            bones=req.bones,
            pose_adjustments=req.pose_adjustments,
            uploads_dir=UPLOADS_DIR,
            draw_skeleton=req.draw_skeleton
        )
        
        # Save Pillow Image into memory buffer
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        
        return StreamingResponse(buf, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render preview frame: {e}")
