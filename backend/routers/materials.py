import os
import shutil
import traceback
import threading
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from backend.config import BASE_DIR, VIDEOS_DIR, MUSIC_DIR, FONTS_DIR, SUBTITLES_DIR, add_log, load_config, save_config
from backend.downloader import download_video, download_audio, download_subtitles, download_xhs_via_sidecar
from backend.editor import get_font_name

router = APIRouter(tags=["materials"])

class DownloadRequest(BaseModel):
    url: str
    material_type: str  # "video", "music", "audio", or "subtitle"

class CategoryUpdateRequest(BaseModel):
    filename: str
    category: str = ""

class FontDownloadRequest(BaseModel):
    url: str
    filename: str | None = None


class MetadataUpdateRequest(BaseModel):
    category: str | None = None
    tags: list[str] | None = None
    source_url: str | None = None

def _safe_filename(filename: str):
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")

@router.get("/api/materials")
async def get_materials():
    """Lists all downloaded video and music materials with SQLite metadata."""
    videos = [f for f in os.listdir(VIDEOS_DIR) if os.path.isfile(os.path.join(VIDEOS_DIR, f)) and not f.startswith(".")]
    music = [f for f in os.listdir(MUSIC_DIR) if os.path.isfile(os.path.join(MUSIC_DIR, f)) and not f.startswith(".")]
    subtitles = [f for f in os.listdir(SUBTITLES_DIR) if os.path.isfile(os.path.join(SUBTITLES_DIR, f)) and not f.startswith(".")]
    
    try:
        from backend.media_db import MediaDB
        db = MediaDB()
        db.sync_filesystem(VIDEOS_DIR, "video")
        db.sync_filesystem(MUSIC_DIR, "music")
        db.sync_filesystem(SUBTITLES_DIR, "subtitle")
        
        videos_enriched = db.enrich(videos, "video")
        music_enriched = db.enrich(music, "music")
        subtitles_enriched = db.enrich(subtitles, "subtitle")
    except Exception as e:
        print(f"Error enriching materials list: {e}")
        videos_enriched = [{"filename": f, "type": "video", "category": "", "tags": [], "source_url": "", "duration": 0.0, "width": 0, "height": 0} for f in videos]
        music_enriched = [{"filename": f, "type": "music", "category": "", "tags": [], "source_url": "", "duration": 0.0} for f in music]
        subtitles_enriched = [{"filename": f, "type": "subtitle", "category": "", "tags": [], "source_url": "", "duration": 0.0} for f in subtitles]

    try:
        from backend.templates import get_intro_templates, get_outro_templates
        intros = get_intro_templates()
        outros = get_outro_templates()
    except Exception:
        intros = []
        outros = []

    # Get uploaded watermarks/logos (images in FONTS_DIR or DOWNLOADS_DIR)
    watermarks = []
    try:
        if os.path.exists(FONTS_DIR):
            watermarks = [f for f in os.listdir(FONTS_DIR) if os.path.isfile(os.path.join(FONTS_DIR, f)) and f.lower().endswith((".png", ".jpg", ".jpeg"))]
    except Exception:
        pass

    config = load_config()
    return {
        "videos": videos_enriched, 
        "music": music_enriched, 
        "subtitles": subtitles_enriched, 
        "intros": intros,
        "outros": outros,
        "watermarks": watermarks,
        "video_categories": config.get("video_categories", {})
    }

@router.get("/api/material-categories")
async def get_material_categories():
    config = load_config()
    categories = config.get("video_categories", {})
    return {
        "video_categories": categories,
        "categories": sorted({cat for cat in categories.values() if cat})
    }

@router.post("/api/material-categories")
async def update_material_category(req: CategoryUpdateRequest):
    _safe_filename(req.filename)
    if not os.path.exists(os.path.join(VIDEOS_DIR, req.filename)):
        raise HTTPException(status_code=404, detail="Video material not found")
    config = load_config()
    categories = dict(config.get("video_categories", {}))
    category = req.category.strip()
    if category:
        categories[req.filename] = category
    else:
        categories.pop(req.filename, None)
    config["video_categories"] = categories
    save_config(config)
    
    # Also update MediaDB category
    try:
        from backend.media_db import MediaDB
        MediaDB().set_metadata(req.filename, category=category)
    except Exception:
        pass
        
    return {"status": "saved", "video_categories": categories}

@router.delete("/api/materials/videos/{filename}")
async def delete_video_material(filename: str):
    """Deletes a video material file from downloads/videos/."""
    _safe_filename(filename)
    file_path = os.path.join(VIDEOS_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            config = load_config()
            categories = dict(config.get("video_categories", {}))
            if filename in categories:
                categories.pop(filename, None)
                config["video_categories"] = categories
                save_config(config)
            
            # Sync filesystem with DB to remove record
            try:
                from backend.media_db import MediaDB
                MediaDB().sync_filesystem(VIDEOS_DIR, "video")
            except Exception:
                pass
                
            return {"status": "deleted", "filename": filename}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {e}")
    raise HTTPException(status_code=404, detail="File not found")

@router.post("/api/materials/{filename}/metadata")
async def update_media_metadata(filename: str, req: MetadataUpdateRequest):
    """Update category, tags, or source_url for a media file in DB."""
    _safe_filename(filename)
    
    # Check if file exists in either videos, music or subtitles
    file_exists = False
    for d in (VIDEOS_DIR, MUSIC_DIR, SUBTITLES_DIR):
        if os.path.exists(os.path.join(d, filename)):
            file_exists = True
            break
            
    if not file_exists:
        raise HTTPException(status_code=404, detail="Media file not found on disk")
        
    try:
        from backend.media_db import MediaDB
        db = MediaDB()
        update_data = {}
        if req.category is not None:
            update_data["category"] = req.category
        if req.tags is not None:
            update_data["tags"] = req.tags
        if req.source_url is not None:
            update_data["source_url"] = req.source_url
            
        db.set_metadata(filename, **update_data)
        return {"status": "updated", "metadata": db.get_metadata(filename)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update metadata: {e}")

@router.post("/api/upload")
async def upload_material(file: UploadFile = File(...), file_type: str = "video"):
    """Handles manual file upload of local videos/music."""
    if file_type not in ["video", "music", "audio", "subtitle", "intro", "outro", "watermark"]:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    if file_type == "video":
        target_dir = VIDEOS_DIR
    elif file_type in {"music", "audio"}:
        target_dir = MUSIC_DIR
    elif file_type == "subtitle":
        target_dir = SUBTITLES_DIR
    elif file_type == "intro":
        from backend.templates import INTROS_DIR
        target_dir = INTROS_DIR
    elif file_type == "outro":
        from backend.templates import OUTROS_DIR
        target_dir = OUTROS_DIR
    elif file_type == "watermark":
        target_dir = FONTS_DIR
    else:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    target_path = os.path.join(target_dir, file.filename)
    
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"filename": file.filename, "status": "uploaded", "path": target_path}

def start_download_job(job_id: str, params: dict):
    req = DownloadRequest(**params)
    from backend.jobs import JobManager
    JobManager().start_job(job_id, run_download_pipeline, req)

def run_download_pipeline(job_id: str, cancel_event: threading.Event, req: DownloadRequest):
    import traceback
    try:
        config = load_config()
        pexels_keys = config.get("pexels_api_keys", [])
        pixabay_keys = config.get("pixabay_api_keys", [])
        
        is_keyword_search = not (req.url.startswith("http://") or req.url.startswith("https://"))
        
        if is_keyword_search:
            add_log(f"Starting stock video search for keyword: '{req.url}'")
            if req.material_type == "video":
                from backend.downloader import search_and_download_stock
                filepath = search_and_download_stock(req.url, VIDEOS_DIR, pexels_keys, pixabay_keys, add_log)
                add_log("[DOWNLOAD_SUCCESS] Stock footage fetched successfully!")
                return {"filepath": filepath}
            else:
                add_log("[DOWNLOAD_ERROR] Keyword search is only supported for video materials. Audio/subtitles require a direct link.")
                raise ValueError("Keyword search is only supported for video materials")
        else:
            add_log(f"Starting downloader for URL: {req.url}")
            is_xhs = any(domain in req.url.lower() for domain in ["xiaohongshu.com", "xhslink.com", "xhscdn.com"])
            if is_xhs:
                try:
                    result = download_xhs_via_sidecar(
                        req.url,
                        req.material_type,
                        SUBTITLES_DIR if req.material_type == "subtitle" else (MUSIC_DIR if req.material_type in {"music", "audio"} else VIDEOS_DIR),
                        config.get("xhs_downloader_api_url", ""),
                        cookie=config.get("xhs_cookie", ""),
                        proxy=config.get("xhs_proxy", ""),
                        log_callback=add_log,
                    )
                except Exception as xhs_err:
                    add_log(f"Warning: XHS sidecar failed: {xhs_err}. Trying yt-dlp fallback.")
                    if cancel_event.is_set(): return
                    if req.material_type == "subtitle":
                        result = download_subtitles(req.url, SUBTITLES_DIR, add_log)
                    elif req.material_type in {"music", "audio"}:
                        result = download_audio(req.url, MUSIC_DIR, add_log)
                    else:
                        result = download_video(req.url, VIDEOS_DIR, add_log)
            elif req.material_type == "video":
                result = download_video(req.url, VIDEOS_DIR, add_log)
            elif req.material_type == "subtitle":
                result = download_subtitles(req.url, SUBTITLES_DIR, add_log)
            else:
                result = download_audio(req.url, MUSIC_DIR, add_log)
            
            add_log("[DOWNLOAD_SUCCESS] Done downloading material!")
            return {"result": result}
    except Exception as e:
        add_log(f"[DOWNLOAD_ERROR] Download failed: {str(e)}")
        add_log(traceback.format_exc())
        raise

@router.post("/api/download")
async def trigger_download(req: DownloadRequest):
    """Triggers material download (direct URL download via yt-dlp or keyword stock search)."""
    is_keyword_search = not (req.url.startswith("http://") or req.url.startswith("https://"))
    if not is_keyword_search:
        from backend.utils.url_safety import validate_download_url
        try:
            validate_download_url(req.url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    from backend.jobs import JobManager, JobType
    job_manager = JobManager()
    job_id = job_manager.create_job(JobType.DOWNLOAD, req.dict())
    job_manager.start_job(job_id, run_download_pipeline, req)
    return {"status": "started", "job_id": job_id}


@router.get("/api/fonts")
async def list_fonts():
    builtin_fonts = [
        {"name": "Arial", "type": "system"},
        {"name": "Georgia", "type": "system"},
        {"name": "Courier New", "type": "system"},
        {"name": "Times New Roman", "type": "system"},
        {"name": "Trebuchet MS", "type": "system"},
        {"name": "Verdana", "type": "system"},
        {"name": "Noto Sans", "type": "system"},
        {"name": "Noto Sans CJK", "type": "system"},
        {"name": "DejaVu Sans", "type": "system"},
    ]
    custom_fonts = []
    for filename in os.listdir(FONTS_DIR):
        if filename.lower().endswith((".ttf", ".otf")):
            path = os.path.join(FONTS_DIR, filename)
            custom_fonts.append({"name": get_font_name(path), "type": "custom", "file": filename})
    return builtin_fonts + sorted(custom_fonts, key=lambda item: item["name"].lower())


@router.post("/api/upload-font")
async def upload_font(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".ttf", ".otf")):
        raise HTTPException(status_code=400, detail="Only .ttf and .otf fonts are supported")
    _safe_filename(file.filename)
    target_path = os.path.join(FONTS_DIR, file.filename)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": file.filename, "font_name": get_font_name(target_path), "status": "uploaded"}


@router.post("/api/fonts/download")
async def download_font(req: FontDownloadRequest):
    from backend.utils.url_safety import validate_download_url
    try:
        validate_download_url(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    filename = req.filename or os.path.basename(req.url.split("?")[0])
    if not filename.lower().endswith((".ttf", ".otf")):
        raise HTTPException(status_code=400, detail="Font URL/file must end with .ttf or .otf")
    _safe_filename(filename)
    target_path = os.path.join(FONTS_DIR, filename)
    try:
        response = requests.get(req.url, timeout=60)
        response.raise_for_status()
        with open(target_path, "wb") as f:
            f.write(response.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Font download failed: {e}")
    return {"filename": filename, "font_name": get_font_name(target_path), "status": "downloaded"}


@router.get("/api/sample")
async def load_sample_script():
    archived_sample = None
    archive_root = os.path.join(BASE_DIR, "_archive")
    if os.path.isdir(archive_root):
        for root, _dirs, files in os.walk(archive_root):
            if "biology.txt" in files:
                archived_sample = os.path.join(root, "biology.txt")
                break
    if archived_sample and os.path.exists(archived_sample):
        with open(archived_sample, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    return {
        "content": (
            "Xin chào! Đây là một kịch bản mẫu dùng để kiểm tra VieNeu-TTS.\n\n"
            "Bạn có thể chọn nhiều video, chia chúng theo danh mục, rồi tạo phụ đề tự động bằng ASR."
        )
    }
