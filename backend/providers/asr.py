import os
from typing import Any


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_asr_response(data: dict[str, Any]) -> list[dict[str, Any]]:
    raw_segments = data.get("segments") or data.get("transcription") or []
    if isinstance(raw_segments, dict):
        raw_segments = raw_segments.get("segments", [])

    normalized = []
    for raw in raw_segments:
        if not isinstance(raw, dict):
            continue
        start = _as_float(raw.get("start") or raw.get("start_time"))
        end = _as_float(raw.get("end") or raw.get("end_time"), start)
        text = str(raw.get("text") or raw.get("transcript") or "").strip()
        words = []
        for word in raw.get("words") or []:
            if not isinstance(word, dict):
                continue
            word_text = str(word.get("word") or word.get("text") or "").strip()
            if not word_text:
                continue
            words.append(
                {
                    "word": word_text,
                    "start": _as_float(word.get("start") or word.get("start_time"), start),
                    "end": _as_float(word.get("end") or word.get("end_time"), end),
                }
            )
        if text or words:
            normalized.append({"start": start, "end": max(end, start), "text": text, "words": words})

    if not normalized and data.get("text"):
        normalized.append({"start": 0.0, "end": 0.0, "text": str(data["text"]).strip(), "words": []})
    return normalized


def transcribe_remote_openai(audio_path: str, config: dict[str, Any], language: str | None = None) -> list[dict[str, Any]]:
    import requests

    url = (config.get("asr_remote_api_url") or "").strip()
    if not url:
        raise RuntimeError("Remote ASR API URL is required for OpenAI-compatible ASR.")

    headers = {}
    api_key = (config.get("asr_remote_api_key") or "").strip()
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"

    timeout = int(config.get("asr_timeout", 900) or 900)
    with open(audio_path, "rb") as audio_file:
        files = {"file": (os.path.basename(audio_path), audio_file, "audio/mpeg")}
        data = {
            "model": config.get("asr_remote_model") or "whisper-1",
            "response_format": "verbose_json",
        }
        if language:
            data["language"] = language.split("-")[0]
        try:
            response = requests.post(
                url,
                data={**data, "timestamp_granularities[]": ["segment", "word"]},
                files=files,
                headers=headers,
                timeout=timeout,
            )
        except TypeError:
            response = requests.post(url, data=data, files=files, headers=headers, timeout=timeout)
    response.raise_for_status()
    return normalize_asr_response(response.json())


def transcribe_remote_custom(audio_path: str, config: dict[str, Any], language: str | None = None) -> list[dict[str, Any]]:
    import requests

    url = (config.get("asr_custom_api_url") or "").strip()
    if not url:
        raise RuntimeError("Custom ASR API URL is required for custom remote ASR.")

    headers = {}
    api_key = (config.get("asr_custom_api_key") or "").strip()
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"

    timeout = int(config.get("asr_timeout", 900) or 900)
    with open(audio_path, "rb") as audio_file:
        files = {"file": (os.path.basename(audio_path), audio_file, "audio/mpeg")}
        data = {"language": language or ""}
        response = requests.post(url, data=data, files=files, headers=headers, timeout=timeout)
    response.raise_for_status()
    return normalize_asr_response(response.json())


def _load_faster_whisper_model(model_path: str, config: dict[str, Any]):
    if not os.path.exists(model_path):
        raise RuntimeError(f"faster-whisper model path does not exist: {model_path}")
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError("Install `faster-whisper` to use local ASR mode.") from exc

    cpu_threads = int(config.get("asr_cpu_threads") or config.get("cpu_threads") or 0)
    kwargs = {
        "device": config.get("asr_device") or "cpu",
        "compute_type": config.get("asr_compute_type") or "int8",
    }
    if cpu_threads > 0:
        kwargs["cpu_threads"] = cpu_threads
    return WhisperModel(model_path, **kwargs)


def transcribe_local(audio_path: str, model_path: str, config: dict[str, Any], language: str | None = None) -> list[dict[str, Any]]:
    model = _load_faster_whisper_model(model_path, config)
    segments, _info = model.transcribe(
        audio_path,
        language=language.split("-")[0] if language else None,
        beam_size=int(config.get("asr_beam_size", 5) or 5),
        word_timestamps=True,
        vad_filter=True,
    )
    normalized = []
    for segment in segments:
        words = []
        for word in getattr(segment, "words", None) or []:
            words.append({"word": word.word.strip(), "start": word.start, "end": word.end})
        normalized.append({"start": segment.start, "end": segment.end, "text": segment.text.strip(), "words": words})
    
    # Free memory immediately
    del model
    import gc
    gc.collect()
    
    return normalized


def managed_model_path(config: dict[str, Any]) -> str:
    model_dir = config.get("asr_model_dir") or os.path.join("downloads", "models", "asr")
    model_name = (config.get("asr_managed_model_name") or "Systran/faster-whisper-small").strip()
    safe_name = model_name.replace("/", "__")
    return os.path.join(model_dir, safe_name)


def download_managed_model(config: dict[str, Any], model_name: str | None = None) -> str:
    from huggingface_hub import snapshot_download

    repo_id = (model_name or config.get("asr_managed_model_name") or "Systran/faster-whisper-small").strip()
    target_root = config.get("asr_model_dir") or os.path.join("downloads", "models", "asr")
    os.makedirs(target_root, exist_ok=True)
    local_dir = os.path.join(target_root, repo_id.replace("/", "__"))
    snapshot_download(repo_id=repo_id, local_dir=local_dir, local_dir_use_symlinks=False)
    return local_dir


def transcribe_audio(
    audio_path: str,
    config: dict[str, Any],
    language: str | None = None,
    provider: str | None = None,
) -> list[dict[str, Any]]:
    selected = provider or config.get("asr_provider") or "remote_openai"
    if selected == "remote_openai":
        return transcribe_remote_openai(audio_path, config, language)
    if selected == "remote_custom":
        return transcribe_remote_custom(audio_path, config, language)
    if selected == "local_faster_whisper":
        model_path = (config.get("asr_local_model_path") or "").strip()
        if not model_path:
            raise RuntimeError("Local faster-whisper ASR requires `asr_local_model_path`.")
        return transcribe_local(audio_path, model_path, config, language)
    if selected == "managed_faster_whisper":
        model_path = managed_model_path(config)
        if not os.path.exists(model_path):
            raise RuntimeError(
                "Managed faster-whisper model is not downloaded yet. Use the explicit ASR model download action first."
            )
        return transcribe_local(audio_path, model_path, config, language)
    raise RuntimeError(f"Unsupported ASR provider: {selected}")

