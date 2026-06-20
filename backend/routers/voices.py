import os
import re
import shutil
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.config import CREDS_PATH, CACHE_DIR, GENERATED_DIR
from backend.tts import list_all_available_voices, synthesize_segment, VIENEU_VOICES, supports_ssml, init_tts_client

router = APIRouter(tags=["voices"])

class VoicePreviewRequest(BaseModel):
    voice_name: str
    language_code: str

@router.get("/api/voices")
async def get_voices():
    """Lists available Google TTS voices and local VieNeu-TTS voices."""
    voices = list_all_available_voices(CREDS_PATH)
    return voices

@router.post("/api/voices/preview")
async def get_voice_preview(req: VoicePreviewRequest):
    """Generates (if not cached) and returns a short preview audio for a voice."""
    voice_name = req.voice_name
    lang_code = req.language_code
    
    previews_dir = os.path.join(GENERATED_DIR, "previews")
    os.makedirs(previews_dir, exist_ok=True)
    
    safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', voice_name)
    preview_filename = f"{safe_name}.mp3"
    preview_path = os.path.join(previews_dir, preview_filename)
    
    if os.path.exists(preview_path) and os.path.getsize(preview_path) > 0:
        return {"url": f"/generated/previews/{preview_filename}"}
        
    is_local = voice_name in VIENEU_VOICES
    is_fish = voice_name in ["Fish-Speech (Default)", "Fish-Speech (Cloned)"]
    is_omnivoice = voice_name in ["OmniVoice (Designed)", "OmniVoice (Cloned)"]
    
    if is_local or "vi-vn" in lang_code.lower():
        text = f"Xin chào! Đây là bản xem trước giọng đọc {voice_name} tiếng Việt của tôi."
    else:
        text = f"Hello! This is a preview of the {voice_name} voice."
        
    segment = {
        "text": text,
        "voice_name": voice_name,
        "rate": 1.0,
        "ssml_capable": False if (is_local or is_fish or is_omnivoice) else supports_ssml(voice_name)
    }
    
    tts_client = None
    if not is_local and not is_fish and not is_omnivoice:
        try:
            tts_client = init_tts_client(CREDS_PATH)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Google TTS Client init failed: {e}")
            
    try:
        audio_path = synthesize_segment(tts_client, segment, CACHE_DIR)
        if os.path.exists(audio_path):
            shutil.copy(audio_path, preview_path)
            return {"url": f"/generated/previews/{preview_filename}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to synthesize preview audio file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating preview: {e}")
