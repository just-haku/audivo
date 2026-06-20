import time
import os
import sqlite3
from fastapi import APIRouter, HTTPException
from backend.config import load_config, CREDS_PATH, DOWNLOADS_DIR
from backend.providers.health import (
    check_all_providers, check_fish_speech, check_omnivoice,
    check_generic_tts, check_asr_remote, check_asr_local, check_google_tts
)

router = APIRouter(tags=["health"])

APP_START_TIME = time.time()

@router.get("/api/health")
async def get_app_health():
    """Basic health check endpoint containing uptime and system status."""
    uptime = int(time.time() - APP_START_TIME)
    
    # Check SQLite DB
    db_ok = False
    db_error = ""
    try:
        from backend.jobs import JOBS_DB_PATH
        conn = sqlite3.connect(JOBS_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception as e:
        db_error = str(e)
        
    return {
        "status": "healthy" if db_ok else "unhealthy",
        "uptime_seconds": uptime,
        "database": {
            "connected": db_ok,
            "error": db_error
        },
        "version": "1.3.0"
    }

@router.get("/api/health/providers")
async def check_providers():
    """Run health checks on all configured TTS and ASR providers."""
    config = load_config()
    try:
        return check_all_providers(config, CREDS_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check providers: {e}")

@router.get("/api/health/providers/{provider}")
async def check_provider(provider: str):
    """Run health check on a specific provider."""
    config = load_config()
    p = provider.strip().lower()
    
    if p == "fish_speech":
        return check_fish_speech(config)
    elif p == "omnivoice":
        return check_omnivoice(config)
    elif p == "generic_tts":
        return check_generic_tts(config)
    elif p == "asr_remote":
        return check_asr_remote(config)
    elif p == "asr_local":
        return check_asr_local(config)
    elif p == "google_tts":
        return check_google_tts(CREDS_PATH)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}. Valid options are: fish_speech, omnivoice, generic_tts, asr_remote, asr_local, google_tts")
