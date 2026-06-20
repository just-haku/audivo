import os
import time
import requests
import socket

def check_http_url(url: str, name: str) -> dict:
    """Helper to check if an HTTP endpoint is reachable."""
    if not url:
        return {"ok": False, "status": "unconfigured", "latency_ms": 0, "error": "URL not configured"}
        
    start_time = time.time()
    try:
        # Try OPTIONS first, fallback to GET (some servers don't support OPTIONS well)
        try:
            response = requests.options(url, timeout=5)
            status_code = response.status_code
        except requests.exceptions.RequestException:
            response = requests.get(url, timeout=5)
            status_code = response.status_code
            
        latency = int((time.time() - start_time) * 1000)
        # Any response from the endpoint means it's online/reachable
        return {
            "ok": True,
            "status": "online",
            "latency_ms": latency,
            "code": status_code
        }
    except requests.exceptions.Timeout:
        return {"ok": False, "status": "timeout", "latency_ms": 5000, "error": "Request timed out after 5s"}
    except requests.exceptions.ConnectionError as e:
        return {"ok": False, "status": "offline", "latency_ms": 0, "error": f"Connection failed: {e}"}
    except Exception as e:
        return {"ok": False, "status": "error", "latency_ms": 0, "error": str(e)}

def check_fish_speech(config: dict) -> dict:
    return check_http_url(config.get("fish_speech_api_url"), "Fish Speech")

def check_omnivoice(config: dict) -> dict:
    return check_http_url(config.get("omnivoice_api_url"), "OmniVoice")

def check_generic_tts(config: dict) -> dict:
    return check_http_url(config.get("generic_tts_api_url"), "Generic TTS")

def check_asr_remote(config: dict) -> dict:
    provider = config.get("asr_provider")
    if provider == "remote_openai":
        return check_http_url(config.get("asr_remote_api_url"), "ASR Remote OpenAI")
    elif provider == "remote_custom":
        return check_http_url(config.get("asr_custom_api_url"), "ASR Remote Custom")
    return {"ok": False, "status": "unconfigured", "latency_ms": 0, "error": "Remote ASR not selected"}

def check_asr_local(config: dict) -> dict:
    provider = config.get("asr_provider")
    if provider not in ("local_faster_whisper", "managed_faster_whisper"):
        return {"ok": False, "status": "unconfigured", "latency_ms": 0, "error": "Local ASR not selected"}
        
    start_time = time.time()
    try:
        # Check faster-whisper imports
        import faster_whisper
        
        # Check model path
        if provider == "local_faster_whisper":
            model_path = config.get("asr_local_model_path", "")
            if not model_path:
                return {"ok": False, "status": "invalid_config", "latency_ms": 0, "error": "ASR Local model path is empty"}
            if not os.path.exists(model_path):
                return {"ok": False, "status": "offline", "latency_ms": 0, "error": f"Model directory does not exist: {model_path}"}
        else: # managed_faster_whisper
            model_name = config.get("asr_managed_model_name", "Systran/faster-whisper-small")
            model_dir = config.get("asr_model_dir", "")
            # Check if directory contains a model
            expected_dir = os.path.join(model_dir, model_name.replace("/", "--"))
            if not os.path.isdir(expected_dir) or not os.listdir(expected_dir):
                return {"ok": False, "status": "missing_model", "latency_ms": 0, "error": f"Managed model '{model_name}' not downloaded yet"}
                
        latency = int((time.time() - start_time) * 1000)
        return {"ok": True, "status": "ready", "latency_ms": latency}
    except ImportError:
        return {"ok": False, "status": "missing_dependency", "latency_ms": 0, "error": "faster-whisper package not installed"}
    except Exception as e:
        return {"ok": False, "status": "error", "latency_ms": 0, "error": str(e)}

def check_google_tts(creds_path: str) -> dict:
    if not creds_path or not os.path.exists(creds_path):
        return {"ok": False, "status": "unconfigured", "latency_ms": 0, "error": f"Google creds.json file not found at {creds_path}"}
        
    start_time = time.time()
    try:
        from google.cloud import texttospeech
        from google.oauth2 import service_account
        
        # Try to initialize the client
        creds = service_account.Credentials.from_service_account_file(creds_path)
        client = texttospeech.TextToSpeechClient(credentials=creds)
        
        # Test call list_voices (cap time at 5s)
        # Note: list_voices checks API connectivity
        client.list_voices(timeout=5.0)
        
        latency = int((time.time() - start_time) * 1000)
        return {"ok": True, "status": "online", "latency_ms": latency}
    except ImportError:
        return {"ok": False, "status": "missing_dependency", "latency_ms": 0, "error": "google-cloud-texttospeech package not installed"}
    except Exception as e:
        return {"ok": False, "status": "error", "latency_ms": 0, "error": str(e)}

def check_all_providers(config: dict, creds_path: str) -> dict:
    """Checks all configured providers."""
    return {
        "fish_speech": check_fish_speech(config),
        "omnivoice": check_omnivoice(config),
        "generic_tts": check_generic_tts(config),
        "asr_remote": check_asr_remote(config),
        "asr_local": check_asr_local(config),
        "google_tts": check_google_tts(creds_path)
    }
