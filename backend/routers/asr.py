from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import load_config
from backend.providers.asr import download_managed_model

router = APIRouter(tags=["asr"])


class AsrModelDownloadRequest(BaseModel):
    model_name: str | None = None


@router.post("/api/asr/models/download")
async def download_asr_model(req: AsrModelDownloadRequest):
    """Explicitly downloads a managed faster-whisper model into downloads/models."""
    config = load_config()
    try:
        path = download_managed_model(config, req.model_name)
        return {"status": "downloaded", "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ASR model download failed: {e}")

