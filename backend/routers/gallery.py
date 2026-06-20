import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.config import GENERATED_DIR

router = APIRouter(tags=["gallery"])

class RenameRequest(BaseModel):
    new_name: str

@router.get("/api/generated-videos")
async def list_generated_videos():
    """Lists all generated videos along with their metadata/settings."""
    videos = []
    if not os.path.exists(GENERATED_DIR):
        return videos
        
    for f in os.listdir(GENERATED_DIR):
        if f.lower().endswith(".mp4") and not f.startswith("."):
            video_path = os.path.join(GENERATED_DIR, f)
            meta_path = os.path.splitext(video_path)[0] + ".json"
            
            settings = None
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        settings = json.load(mf)
                except Exception:
                    pass
                    
            st = os.stat(video_path)
            created_at = st.st_mtime
            
            videos.append({
                "filename": f,
                "url": f"/generated/{f}",
                "size": st.st_size,
                "created_at": created_at,
                "settings": settings
            })
            
    videos.sort(key=lambda x: x["created_at"], reverse=True)
    return videos

@router.delete("/api/generated-videos/{filename}")
async def delete_generated_video(filename: str):
    """Deletes a generated video and its corresponding metadata json file."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    video_path = os.path.join(GENERATED_DIR, filename)
    meta_path = os.path.splitext(video_path)[0] + ".json"
    
    deleted = False
    if os.path.exists(video_path):
        os.remove(video_path)
        deleted = True
    if os.path.exists(meta_path):
        os.remove(meta_path)
        
    if deleted:
        return {"status": "deleted", "filename": filename}
    raise HTTPException(status_code=404, detail="Video not found")

@router.post("/api/generated-videos/{filename}/rename")
async def rename_generated_video(filename: str, req: RenameRequest):
    """Renames a generated video and its metadata json file."""
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    new_name = req.new_name.strip()
    if not new_name.lower().endswith(".mp4"):
        new_name += ".mp4"
        
    if "/" in new_name or "\\" in new_name or new_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid new name")
        
    old_video_path = os.path.join(GENERATED_DIR, filename)
    new_video_path = os.path.join(GENERATED_DIR, new_name)
    
    old_meta_path = os.path.splitext(old_video_path)[0] + ".json"
    new_meta_path = os.path.splitext(new_video_path)[0] + ".json"
    
    if not os.path.exists(old_video_path):
        raise HTTPException(status_code=404, detail="Original video not found")
        
    if os.path.exists(new_video_path):
        raise HTTPException(status_code=400, detail="A video with the new name already exists")
        
    os.rename(old_video_path, new_video_path)
    if os.path.exists(old_meta_path):
        os.rename(old_meta_path, new_meta_path)
        
    return {"status": "renamed", "old_name": filename, "new_name": new_name}
