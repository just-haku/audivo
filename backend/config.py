import os
import json

os.environ["TOKENIZERS_PARALLELISM"] = "false"



BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
VIDEOS_DIR = os.path.join(DOWNLOADS_DIR, "videos")
MUSIC_DIR = os.path.join(DOWNLOADS_DIR, "music")
GENERATED_DIR = os.path.join(DOWNLOADS_DIR, "generated")
FONTS_DIR = os.path.join(DOWNLOADS_DIR, "fonts")
SUBTITLES_DIR = os.path.join(DOWNLOADS_DIR, "subtitles")
MODELS_DIR = os.path.join(DOWNLOADS_DIR, "models")
XHS_DIR = os.path.join(DOWNLOADS_DIR, "xhs")
CACHE_DIR = os.path.join(BASE_DIR, "backend", "cache")
CREDS_PATH = os.path.join(BASE_DIR, "creds.json")

# Ensure required directories exist at startup
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs(MUSIC_DIR, exist_ok=True)
os.makedirs(GENERATED_DIR, exist_ok=True)
os.makedirs(FONTS_DIR, exist_ok=True)
os.makedirs(SUBTITLES_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(XHS_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)


# Global logs list for SSE streaming
log_buffer = []

def add_log(msg: str):
    print(msg)  # Terminal print
    log_buffer.append(msg)
    try:
        from backend.jobs import get_current_job_id, JobManager
        job_id = get_current_job_id()
        if job_id:
            JobManager().add_job_log(job_id, msg)
    except Exception:
        pass

DEFAULT_CONFIG = {
    "pexels_api_keys": [],
    "pixabay_api_keys": [],
    "gemini_api_keys": [],
    "groq_api_keys": [],
    "deepseek_api_keys": [],
    "xai_api_keys": [],
    "ollama_urls": ["http://localhost:11434"],
    "cpu_threads": 0,
    "docker_cpus": "10.0",
    "docker_mem": "8G",
    "vieneu_dynamic_batching": False,
    "vieneu_version": "v2",
    "vieneu_mode": "local",
    "vieneu_api_base": "http://localhost:23333/v1",
    "vieneu_model_name": "pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF",
    "vieneu_onnx_dir": "",
    "vieneu_codec_dir": "",
    "vieneu_hf_offline": True,
    "vieneu_batch_paragraphs": 1,
    "vieneu_subprocess_batch_size": 12,
    "render_max_workers": 2,
    "resource_guard_ram_limit_mb": 1500,
    "resource_guard_cpu_load_pct": 90,
    "resource_guard_enabled": True,
    "fish_speech_api_url": "",
    "fish_speech_api_key": "",
    "fish_speech_ref_audio": "",
    "fish_speech_request_format": "msgpack",
    "omnivoice_api_url": "",
    "omnivoice_api_key": "",
    "omnivoice_model": "omnivoice",
    "omnivoice_ref_audio": "",
    "omnivoice_instruct": "female, clear speech",
    "generic_tts_api_url": "",
    "generic_tts_api_key": "",
    "generic_tts_model": "tts-1",
    "generic_tts_voice": "default",
    "remote_tts_timeout": 600,
    "asr_provider": "remote_openai",
    "asr_remote_api_url": "",
    "asr_remote_api_key": "",
    "asr_remote_model": "whisper-1",
    "asr_custom_api_url": "",
    "asr_custom_api_key": "",
    "asr_local_model_path": "",
    "asr_model_dir": os.path.join(MODELS_DIR, "asr"),
    "asr_managed_model_name": "Systran/faster-whisper-small",
    "asr_device": "cpu",
    "asr_compute_type": "int8",
    "asr_cpu_threads": 0,
    "asr_beam_size": 5,
    "asr_timeout": 900,
    "subtitle_timing_source": "asr",
    "subtitle_fallback_to_estimated": True,
    "subtitle_max_chars": 42,
    "subtitle_max_duration": 4.0,
    "subtitle_min_duration": 0.8,
    "video_categories": {},
    "xhs_downloader_api_url": "http://xhs-downloader:5556/xhs/detail",
    "xhs_cookie": "",
    "xhs_proxy": "",
    "webgpu_enabled": True,
    "webgpu_tts_enabled": False,
    "max_job_threads": 0,
    "wipe_cache_after_generation": False,
    "max_batch": 1,
    "render_chunk_size": 50,
    "presets": {
        "Shorts Vietnamese VieNeu": {
            "aspect_ratio": "9:16",
            "default_voice": "Ngọc Linh",
            "subtitle_font": "Noto Sans CJK",
            "subtitle_font_size": 52,
            "bg_music_volume": 0.15,
            "video_speed": 1.0,
            "mute_video": True
        },
        "YouTube Landscape": {
            "aspect_ratio": "16:9",
            "default_voice": "en-US-Neural2-F",
            "subtitle_font": "Arial",
            "subtitle_font_size": 42,
            "bg_music_volume": 0.2,
            "video_speed": 1.0,
            "mute_video": True
        },
        "No BGM": {
            "bg_music": [],
            "bg_music_volume": 0
        }
    }
}

def load_config() -> dict:
    """Loads settings from config.json. If missing, initializes it with defaults."""
    if not os.path.exists(CONFIG_PATH):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG
        
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
            
            # Migration of old keys to lists
            if "pexels_api_key" in config:
                val = config.pop("pexels_api_key")
                if val:
                    config.setdefault("pexels_api_keys", [])
                    if val not in config["pexels_api_keys"]:
                        config["pexels_api_keys"].append(val)
            if "pixabay_api_key" in config:
                val = config.pop("pixabay_api_key")
                if val:
                    config.setdefault("pixabay_api_keys", [])
                    if val not in config["pixabay_api_keys"]:
                        config["pixabay_api_keys"].append(val)
            if "gemini_api_key" in config:
                val = config.pop("gemini_api_key")
                if val:
                    config.setdefault("gemini_api_keys", [])
                    if val not in config["gemini_api_keys"]:
                        config["gemini_api_keys"].append(val)

            if str(config.get("omnivoice_api_url", "")).strip().lower() in {"local", "none"}:
                config["omnivoice_api_url"] = ""
            if str(config.get("fish_speech_api_url", "")).strip().lower() in {"local", "none"}:
                config["fish_speech_api_url"] = ""
                        
            # Merge with defaults in case of missing keys
            for k, v in DEFAULT_CONFIG.items():
                if k not in config:
                    config[k] = v
            return config
    except Exception:
        return DEFAULT_CONFIG

def sync_env_file(config_data: dict):
    env_path = os.path.join(BASE_DIR, ".env")
    lines = []
    existing_vars = {}
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            for line in lines:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.split("=", 1)
                    existing_vars[k.strip()] = v.strip()
        except Exception:
            pass

    # Update vars from config
    docker_cpus = config_data.get("docker_cpus") or existing_vars.get("DOCKER_CPUS") or "10.0"
    docker_mem = config_data.get("docker_mem") or existing_vars.get("DOCKER_MEM") or "8G"
    
    new_lines = []
    has_cpus = False
    has_mem = False
    
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            k, _ = line.split("=", 1)
            k_strip = k.strip()
            if k_strip == "DOCKER_CPUS":
                new_lines.append(f"DOCKER_CPUS={docker_cpus}\n")
                has_cpus = True
            elif k_strip == "DOCKER_MEM":
                new_lines.append(f"DOCKER_MEM={docker_mem}\n")
                has_mem = True
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    if not has_cpus:
        new_lines.append(f"DOCKER_CPUS={docker_cpus}\n")
    if not has_mem:
        new_lines.append(f"DOCKER_MEM={docker_mem}\n")

    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        print(f"Error syncing .env file: {e}")

def save_config(config_data: dict):
    """Saves settings back to config.json, merging with existing config to preserve manual edits."""
    try:
        existing = {}
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except Exception:
                pass

        merged = {}
        for k in DEFAULT_CONFIG.keys():
            if k in config_data:
                merged[k] = config_data[k]
            elif k in existing:
                merged[k] = existing[k]
            else:
                merged[k] = DEFAULT_CONFIG[k]

        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=4)
            
        sync_env_file(merged)
    except Exception as e:
        print(f"Error saving config.json: {e}")
