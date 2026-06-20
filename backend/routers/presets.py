from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.config import load_config, save_config

router = APIRouter(tags=["presets"])

class PresetSaveRequest(BaseModel):
    name: str
    settings: dict

@router.get("/api/presets")
async def list_presets():
    """List all saved project presets."""
    config = load_config()
    return config.get("presets", {})

@router.get("/api/presets/{name}")
async def get_preset(name: str):
    """Retrieve settings for a specific preset."""
    config = load_config()
    presets = config.get("presets", {})
    if name not in presets:
        raise HTTPException(status_code=404, detail=f"Preset '{name}' not found")
    return presets[name]

@router.post("/api/presets")
async def save_preset(req: PresetSaveRequest):
    """Create or update a project preset."""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Preset name cannot be empty")
        
    config = load_config()
    presets = dict(config.get("presets", {}))
    presets[name] = req.settings
    config["presets"] = presets
    save_config(config)
    return {"status": "saved", "name": name, "presets": presets}

@router.delete("/api/presets/{name}")
async def delete_preset(name: str):
    """Delete a project preset."""
    config = load_config()
    presets = dict(config.get("presets", {}))
    if name not in presets:
        raise HTTPException(status_code=404, detail=f"Preset '{name}' not found")
        
    presets.pop(name, None)
    config["presets"] = presets
    save_config(config)
    return {"status": "deleted", "name": name, "presets": presets}
