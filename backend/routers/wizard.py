import os
import shutil
import subprocess
import sys
import shutil
from fastapi import APIRouter
from backend.config import DOWNLOADS_DIR, MODELS_DIR, load_config
from backend.providers.health import (
    check_fish_speech,
    check_omnivoice,
    check_generic_tts,
    check_asr_remote,
)

router = APIRouter(tags=["wizard"])

@router.get("/api/wizard/check")
async def run_wizard_diagnostics():
    """Runs all diagnostic checks for the VideoCreator installation."""
    config = load_config()
    
    # 1. Check FFmpeg presence
    ffmpeg_ok = False
    ffmpeg_version = "Not found"
    ffmpeg_path = shutil.which("ffmpeg")
    if ffmpeg_path:
        try:
            res = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                ffmpeg_ok = True
                first_line = res.stdout.split("\n")[0]
                ffmpeg_version = first_line.split("version")[-1].strip().split("Copyright")[0].strip()
            else:
                ffmpeg_version = "Found but failed to run"
        except Exception as e:
            ffmpeg_version = f"Error running ffmpeg: {e}"
            
    # 2. Check Disk Space
    disk_ok = False
    disk_free_gb = 0.0
    disk_total_gb = 0.0
    try:
        total, used, free = shutil.disk_usage(DOWNLOADS_DIR)
        disk_free_gb = free / (1024**3)
        disk_total_gb = total / (1024**3)
        # We want at least 2 GB free for decent work
        if disk_free_gb >= 2.0:
            disk_ok = True
    except Exception:
        pass
        
    # 3. Check VieNeu Model directories
    vieneu_ok = False
    version = config.get("vieneu_version", "v2")
    if version == "v2":
        v2_dir = config.get("vieneu_onnx_dir") or os.path.join(MODELS_DIR, "vieneu", "v2")
        gguf_path = os.path.join(v2_dir, "vieneu-tts-v2-turbo.gguf")
        codec_dir = config.get("vieneu_codec_dir") or os.path.join(v2_dir, "codec")
        dec_path = os.path.join(codec_dir, "vieneu_decoder.onnx")
        
        onnx_exists = os.path.exists(gguf_path) and os.path.getsize(gguf_path) > 0
        codec_exists = os.path.exists(dec_path) and os.path.getsize(dec_path) > 0
        onnx_dir = v2_dir
    else:
        onnx_dir = config.get("vieneu_onnx_dir") or os.path.join(MODELS_DIR, "vieneu", "onnx")
        resolved_onnx_dir = onnx_dir
        if not config.get("vieneu_onnx_dir"):
            nested_onnx = os.path.join(onnx_dir, "onnx")
            if os.path.exists(nested_onnx) and len(os.listdir(nested_onnx)) > 0:
                resolved_onnx_dir = nested_onnx

        codec_dir = config.get("vieneu_codec_dir") or os.path.join(MODELS_DIR, "vieneu", "codec")
        onnx_exists = os.path.exists(resolved_onnx_dir) and len(os.listdir(resolved_onnx_dir)) > 0 if os.path.exists(resolved_onnx_dir) else False
        codec_exists = os.path.exists(codec_dir) and len(os.listdir(codec_dir)) > 0 if os.path.exists(codec_dir) else False

    if onnx_exists and codec_exists:
        vieneu_ok = True
        
    # 4. Check Optional Python Packages
    packages = {
        "faster_whisper": False,
        "llama_cpp": False,
        "google.cloud.texttospeech": False,
        "google.generativeai": False,
        "ormsgpack": False
    }
    for pkg in packages.keys():
        try:
            __import__(pkg)
            packages[pkg] = True
        except ImportError:
            pass
            
    # 5. Check Remote APIs
    api_status = {
        "fish_speech": {"ok": False, "msg": "Not configured"},
        "omnivoice": {"ok": False, "msg": "Not configured"},
        "generic_tts": {"ok": False, "msg": "Not configured"},
        "asr_remote": {"ok": False, "msg": "Not configured"},
    }
    
    # Fish speech
    if config.get("fish_speech_api_url"):
        try:
            res = check_fish_speech(config)
            api_status["fish_speech"] = {"ok": res.get("ok", False), "msg": res.get("error", "OK")}
        except Exception as e:
            api_status["fish_speech"] = {"ok": False, "msg": str(e)}
            
    # OmniVoice
    if config.get("omnivoice_api_url"):
        try:
            res = check_omnivoice(config)
            api_status["omnivoice"] = {"ok": res.get("ok", False), "msg": res.get("error", "OK")}
        except Exception as e:
            api_status["omnivoice"] = {"ok": False, "msg": str(e)}
            
    # Generic TTS
    if config.get("generic_tts_api_url"):
        try:
            res = check_generic_tts(config)
            api_status["generic_tts"] = {"ok": res.get("ok", False), "msg": res.get("error", "OK")}
        except Exception as e:
            api_status["generic_tts"] = {"ok": False, "msg": str(e)}
            
    # Remote ASR
    if config.get("asr_remote_api_url"):
        try:
            res = check_asr_remote(config)
            api_status["asr_remote"] = {"ok": res.get("ok", False), "msg": res.get("error", "OK")}
        except Exception as e:
            api_status["asr_remote"] = {"ok": False, "msg": str(e)}
            
    # 6. Check ASR Readiness
    asr_readiness = {
        "local_model_exists": False,
        "managed_model_exists": False,
    }
    local_path = config.get("asr_local_model_path")
    if local_path and os.path.exists(local_path) and os.listdir(local_path):
        asr_readiness["local_model_exists"] = True
        
    from backend.providers.asr import managed_model_path
    managed_dir = managed_model_path(config)
    if os.path.exists(managed_dir) and os.listdir(managed_dir):
        asr_readiness["managed_model_exists"] = True

    return {
        "ffmpeg": {
            "ok": ffmpeg_ok,
            "path": ffmpeg_path or "Not found",
            "version": ffmpeg_version
        },
        "disk_space": {
            "ok": disk_ok,
            "free_gb": round(disk_free_gb, 2),
            "total_gb": round(disk_total_gb, 2)
        },
        "vieneu_models": {
            "ok": vieneu_ok,
            "onnx_exists": onnx_exists,
            "codec_exists": codec_exists,
            "onnx_dir": onnx_dir,
            "codec_dir": codec_dir
        },
        "python_packages": packages,
        "remote_apis": api_status,
        "asr_readiness": asr_readiness
    }
