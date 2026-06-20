from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from backend.config import load_config, save_config, CONFIG_PATH
from backend.utils.redact import redact_config

router = APIRouter(tags=["config"])

@router.get("/api/config")
async def get_app_config(redacted: bool = False):
    """Retrieves API keys config."""
    config = load_config()
    if redacted:
        return redact_config(config)
    return config

@router.post("/api/config")
async def save_app_config(config: dict):
    """Saves API keys config."""
    save_config(config)
    return {"status": "saved"}

@router.get("/api/config/export")
async def export_config():
    """Download config.json as a redacted attachment."""
    try:
        config = load_config()
        redacted = redact_config(config)
        headers = {"Content-Disposition": 'attachment; filename="turbo_config.json"'}
        return JSONResponse(content=redacted, headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export config: {e}")

@router.post("/api/config/import")
async def import_config(file: UploadFile = File(...)):
    """Upload config.json and save it."""
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Must be a JSON file")
        
    try:
        content = await file.read()
        import json
        config_data = json.loads(content.decode("utf-8"))
        save_config(config_data)
        return {"status": "success", "config": config_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config file: {e}")

