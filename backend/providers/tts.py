import base64
import hashlib
import json
import os
import re
import subprocess
import time
import uuid
from typing import Any

FALLBACK_GOOGLE_VOICES = {
    "en-US (United States)": [
        {"name": "en-US-Neural2-F", "gender": "FEMALE"},
        {"name": "en-US-Neural2-J", "gender": "MALE"},
        {"name": "en-US-Studio-O", "gender": "FEMALE"},
        {"name": "en-US-Wavenet-D", "gender": "MALE"},
    ],
    "en-GB (United Kingdom)": [
        {"name": "en-GB-Neural2-B", "gender": "MALE"},
        {"name": "en-GB-Wavenet-A", "gender": "FEMALE"},
        {"name": "en-GB-Wavenet-B", "gender": "MALE"},
    ],
    "vi-VN (Vietnam)": [
        {"name": "vi-VN-Neural2-A", "gender": "FEMALE"},
        {"name": "vi-VN-Neural2-D", "gender": "MALE"},
        {"name": "vi-VN-Wavenet-A", "gender": "FEMALE"},
        {"name": "vi-VN-Wavenet-C", "gender": "MALE"},
    ],
}

VIENEU_V3_VOICES = {
    "Ngọc Linh": "nữ, giọng tươi sáng (Default)",
    "Ngọc Lan": "nữ, giọng dịu dàng",
    "Mỹ Duyên": "nữ, giọng mượt mà",
    "Trúc Ly": "nữ, giọng trẻ trung",
    "Gia Bảo": "nam, giọng mượt mà",
    "Thái Sơn": "nam, giọng chắc khỏe",
    "Đức Trí": "nam, giọng rõ ràng",
    "Xuân Vĩnh": "nam, giọng vui tươi",
    "Trọng Hữu": "nam, giọng uyên bác",
    "Bình An": "nam, giọng điềm đạm",
}

VIENEU_V2_VOICES = {
    "Ngoc": "Ngọc (nữ miền Bắc) (Default)",
    "Ly": "Ly (nữ miền Bắc)",
    "Doan": "Đoan (nữ miền Nam)",
    "Binh": "Bình (nam miền Bắc)",
    "Tuyen": "Tuyên (nam miền Bắc)",
    "Vinh": "Vĩnh (nam miền Nam)",
}

VIENEU_VOICES = {**VIENEU_V3_VOICES, **VIENEU_V2_VOICES}
FISH_VOICES = ["Fish-Speech (Default)", "Fish-Speech (Cloned)"]
OMNIVOICE_VOICES = ["OmniVoice (Designed)", "OmniVoice (Cloned)"]
GENERIC_TTS_VOICES = ["Generic API TTS"]

FISH_EXPRESSION_TAGS = [
    "[excited]",
    "[angry]",
    "[sad]",
    "[happy]",
    "[fearful]",
    "[surprised]",
    "[disgusted]",
    "[contempt]",
    "[calm]",
    "[serious]",
    "[sarcastic]",
    "[laughter]",
    "[breath]",
    "[sigh]",
    "[whisper]",
    "[slow]",
    "[fast]",
    "[pause]",
]

OMNIVOICE_EXPRESSION_TAGS = [
    "[laughter]",
    "[sigh]",
    "[dissatisfaction-hnn]",
    "[question-en]",
    "[question-ah]",
    "[question-oh]",
    "[question-ei]",
    "[question-yi]",
    "[surprise-ah]",
    "[surprise-oh]",
    "[surprise-wa]",
    "[surprise-yo]",
    "[confirmation-en]",
]

VIENEU_EXPRESSION_TAGS = ["[cười]", "[thở dài]", "[hắng giọng]"]


def get_optimal_workers() -> int:
    try:
        from backend.config import load_config

        config = load_config()
        configured_threads = config.get("cpu_threads", 0)
        if configured_threads and configured_threads > 0:
            return int(configured_threads)
    except Exception:
        pass
    cores = os.cpu_count() or 4
    if cores >= 12:
        return 4  # Conservative default thread cap to prevent laptop thermal/OOM crashes
    if cores >= 8:
        return 3
    if cores >= 4:
        return 2
    return 1


def init_tts_client(creds_path: str):
    from google.cloud import texttospeech
    from google.oauth2 import service_account

    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Google Cloud credentials not found at {creds_path}")
    creds = service_account.Credentials.from_service_account_file(creds_path)
    return texttospeech.TextToSpeechClient(credentials=creds)


def is_vieneu_voice(voice_name: str) -> bool:
    return voice_name in VIENEU_VOICES


def is_fish_voice(voice_name: str) -> bool:
    return voice_name in FISH_VOICES


def is_omnivoice_voice(voice_name: str) -> bool:
    return voice_name in OMNIVOICE_VOICES


def is_generic_tts_voice(voice_name: str) -> bool:
    return voice_name in GENERIC_TTS_VOICES


def get_voice_provider(voice_name: str) -> str:
    if is_vieneu_voice(voice_name):
        return "vieneu"
    if is_fish_voice(voice_name):
        return "fish"
    if is_omnivoice_voice(voice_name):
        return "omnivoice"
    if is_generic_tts_voice(voice_name):
        return "generic"
    return "google"


def extract_rate_from_string(rate_str: str) -> float:
    if not rate_str:
        return 1.0
    match = re.search(r"(\d+)%", rate_str)
    if match:
        return round(float(match.group(1)) / 100.0, 2)
    try:
        return float(rate_str)
    except ValueError:
        return 1.0


def supports_ssml(voice_name: str) -> bool:
    if get_voice_provider(voice_name) != "google":
        return False
    if any(tag in voice_name for tag in ["Wavenet", "Studio", "Neural2"]):
        return True
    if "Chirp" in voice_name or "HD" in voice_name:
        return False
    return True


def clean_for_studio(ssml_text: str) -> str:
    text = ssml_text
    text = re.sub(r"</?emphasis[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r'pitch\s*=\s*"[^"]*"', "", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(lang|mark)[^>]*>", "", text, flags=re.IGNORECASE)
    return text


def split_text_into_sentences(text: str) -> list[str]:
    if not text:
        return []

    splits = []
    start = 0
    i = 0
    closing_chars = set(['"', "'", "”", "’", ")", "]", "}", "»"])
    terminal_punct = set([".", "!", "?", "。", "！", "？"])

    while i < len(text):
        if text[i] in terminal_punct:
            i += 1
            while i < len(text) and text[i] in closing_chars:
                i += 1
            end = i
            while i < len(text) and text[i].isspace():
                i += 1
            segment = text[start:end].strip()
            if segment:
                splits.append(segment)
            start = i
        else:
            i += 1

    if start < len(text):
        segment = text[start:].strip()
        if segment:
            splits.append(segment)
    return splits


def _group_paragraphs(paragraphs: list[str], batch_size: int) -> list[str]:
    safe_size = min(max(int(batch_size or 1), 1), 20)
    return [
        "\n\n".join(paragraphs[i : i + safe_size])
        for i in range(0, len(paragraphs), safe_size)
    ]


def parse_script(
    script_content: str,
    default_voice: str = "en-US-Neural2-F",
    vieneu_batch_paragraphs: int = 1,
) -> list[dict[str, Any]]:
    script_content = script_content.strip()
    if not script_content:
        return []

    voice_blocks = re.findall(
        r'<voice\s+name="([^"]+)">\s*<speak>\s*<prosody(?:\s+rate="([^"]+)")?>\s*(.*?)\s*</prosody>\s*</speak>\s*</voice>',
        script_content,
        re.DOTALL | re.IGNORECASE,
    )

    parsed_segments: list[dict[str, Any]] = []
    if voice_blocks:
        for voice_name, rate_str, block_text in voice_blocks:
            block_trimmed = block_text.strip()
            if block_trimmed:
                parsed_segments.append(
                    {
                        "text": block_trimmed,
                        "voice_name": voice_name,
                        "rate": extract_rate_from_string(rate_str),
                        "ssml_capable": supports_ssml(voice_name),
                    }
                )
        return parsed_segments

    provider = get_voice_provider(default_voice)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", script_content) if p.strip()]
    if provider in {"google", "vieneu"}:
        text_units = []
        for paragraph in paragraphs:
            text_units.extend(split_text_into_sentences(paragraph))
    else:
        text_units = paragraphs

    for text in text_units:
        parsed_segments.append(
            {
                "text": text,
                "voice_name": default_voice,
                "rate": 1.0,
                "ssml_capable": supports_ssml(default_voice),
            }
        )
    return parsed_segments


def remove_punctuations(text: str, is_google: bool = True) -> str:
    if is_google:
        text = re.sub(r"\[[^\]]+\]", " ", text)
    return " ".join(text.split())


def prepare_segment_text(segment: dict[str, Any], config: dict[str, Any]) -> str:
    voice_name = segment["voice_name"]
    provider = get_voice_provider(voice_name)
    version = config.get("vieneu_version", "v3")
    strip_tags = provider in {"google", "fish", "generic"} or (
        provider == "vieneu" and version == "v2"
    )
    text = remove_punctuations(segment["text"], is_google=strip_tags)
    return text or " "


def get_cached_output_path(segment: dict[str, Any], cache_dir: str, config: dict[str, Any]) -> str:
    voice_name = segment["voice_name"]
    rate = segment["rate"]
    ssml_capable = segment["ssml_capable"]
    text = prepare_segment_text(segment, config)
    provider = get_voice_provider(voice_name)
    cache_salt = {
        "provider": provider,
        "vieneu_version": config.get("vieneu_version", "v3"),
        "fish_url": config.get("fish_speech_api_url", "") if provider == "fish" else "",
        "omni_url": config.get("omnivoice_api_url", "") if provider == "omnivoice" else "",
        "generic_url": config.get("generic_tts_api_url", "") if provider == "generic" else "",
    }
    hash_input = json.dumps(
        {
            "text": text,
            "voice": voice_name,
            "rate": rate,
            "ssml": ssml_capable,
            "salt": cache_salt,
        },
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    filename_hash = hashlib.md5(hash_input).hexdigest()
    ext = "wav" if provider == "vieneu" else "mp3"
    return os.path.join(cache_dir, f"{filename_hash}.{ext}")


def _require_url(config: dict[str, Any], key: str, provider_name: str) -> str:
    url = (config.get(key) or "").strip()
    if not url or url.lower() in {"local", "none", "disabled"}:
        raise RuntimeError(
            f"{provider_name} requires a remote API URL. Configure it in Settings before selecting this voice."
        )
    return url


def _read_reference_audio(ref_audio: str) -> tuple[bytes | None, str]:
    if not ref_audio or not os.path.exists(ref_audio):
        return None, ""
    with open(ref_audio, "rb") as audio_file:
        audio_bytes = audio_file.read()
    ref_text = ""
    txt_path = os.path.splitext(ref_audio)[0] + ".txt"
    if os.path.exists(txt_path):
        with open(txt_path, "r", encoding="utf-8") as text_file:
            ref_text = text_file.read().strip()
    return audio_bytes, ref_text


def synthesize_fish_speech(text: str, voice_name: str, rate: float, config: dict[str, Any]) -> bytes:
    import requests

    url = _require_url(config, "fish_speech_api_url", "Fish Speech")
    api_key = (config.get("fish_speech_api_key") or "").strip()
    ref_audio = (config.get("fish_speech_ref_audio") or "").strip()
    request_format = (config.get("fish_speech_request_format") or "msgpack").lower()
    timeout = int(config.get("remote_tts_timeout", 600) or 600)

    references: list[dict[str, Any]] = []
    reference_id = None
    if voice_name == "Fish-Speech (Cloned)" and ref_audio:
        audio_bytes, ref_text = _read_reference_audio(ref_audio)
        if audio_bytes is not None:
            references.append({"audio": audio_bytes, "text": ref_text})
        else:
            reference_id = ref_audio

    payload = {
        "text": text,
        "references": references,
        "reference_id": reference_id,
        "format": "mp3",
        "latency": config.get("fish_speech_latency", "normal"),
        "chunk_length": int(config.get("fish_speech_chunk_length", 300) or 300),
        "max_new_tokens": int(config.get("fish_speech_max_new_tokens", 1024) or 1024),
        "top_p": float(config.get("fish_speech_top_p", 0.8) or 0.8),
        "repetition_penalty": float(config.get("fish_speech_repetition_penalty", 1.1) or 1.1),
        "temperature": float(config.get("fish_speech_temperature", 0.8) or 0.8),
        "streaming": False,
        "use_memory_cache": "off",
    }
    headers = {}
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"

    if request_format == "json":
        json_payload = dict(payload)
        json_payload["references"] = [
            {"audio": base64.b64encode(ref["audio"]).decode("utf-8"), "text": ref["text"]}
            for ref in references
        ]
        response = requests.post(url, json=json_payload, headers=headers, timeout=timeout)
    else:
        try:
            import ormsgpack
        except ImportError as exc:
            raise RuntimeError(
                "Fish Speech msgpack mode requires `ormsgpack`. Install requirements or set fish_speech_request_format=json."
            ) from exc
        headers["content-type"] = "application/msgpack"
        response = requests.post(
            url,
            params={"format": "msgpack"},
            data=ormsgpack.packb(payload),
            headers=headers,
            timeout=timeout,
        )

    response.raise_for_status()
    return response.content


def synthesize_openai_speech(
    text: str,
    url: str,
    api_key: str,
    model: str,
    voice: str,
    rate: float,
    instructions: str = "",
    timeout: int = 600,
) -> bytes:
    import requests

    payload = {
        "model": model,
        "input": text,
        "voice": voice,
        "speed": rate,
        "response_format": "mp3",
    }
    if instructions:
        payload["instructions"] = instructions

    headers = {"content-type": "application/json"}
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"
    response = requests.post(url, json=payload, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.content


def synthesize_omnivoice_api(text: str, voice_name: str, rate: float, config: dict[str, Any]) -> bytes:
    url = _require_url(config, "omnivoice_api_url", "OmniVoice")
    api_key = (config.get("omnivoice_api_key") or "").strip()
    ref_audio = (config.get("omnivoice_ref_audio") or "").strip()
    instruct = (config.get("omnivoice_instruct") or "female, clear speech").strip()
    model = (config.get("omnivoice_model") or "omnivoice").strip()
    timeout = int(config.get("remote_tts_timeout", 600) or 600)
    voice = ref_audio if voice_name == "OmniVoice (Cloned)" and ref_audio else "auto"
    return synthesize_openai_speech(text, url, api_key, model, voice, rate, instruct, timeout)


def synthesize_generic_tts(text: str, voice_name: str, rate: float, config: dict[str, Any]) -> bytes:
    url = _require_url(config, "generic_tts_api_url", "Generic API TTS")
    api_key = (config.get("generic_tts_api_key") or "").strip()
    model = (config.get("generic_tts_model") or "tts-1").strip()
    voice = (config.get("generic_tts_voice") or voice_name or "default").strip()
    timeout = int(config.get("remote_tts_timeout", 600) or 600)
    return synthesize_openai_speech(text, url, api_key, model, voice, rate, "", timeout)


def check_resources_and_cool_down(add_log_fn):
    import time
    import gc
    import os

    gc.collect()
    
    # 1. Check RAM available and Swap
    try:
        if os.path.exists('/proc/meminfo'):
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
            mem_info = {}
            for line in lines:
                if ':' in line:
                    k, v = line.split(':', 1)
                    mem_info[k.strip()] = v.strip()
                    
            def to_mb(val):
                parts = val.split()
                if len(parts) >= 1:
                    num = int(parts[0])
                    if len(parts) >= 2 and parts[1].lower() == 'kb':
                        return num // 1024
                    return num
                return 0
                
            mem_total = to_mb(mem_info.get("MemTotal", "0"))
            mem_avail = to_mb(mem_info.get("MemAvailable", "0"))
            
            if mem_avail > 0 and mem_total > 0:
                avail_pct = (mem_avail / mem_total) * 100
                if mem_avail < 1524 or avail_pct < 10.0:
                    add_log_fn(f"[Resource Guard] Available RAM is low ({mem_avail}MB / {mem_total}MB, {avail_pct:.1f}%). Pausing 6s to let the OS swap and reclaim memory...")
                    time.sleep(6)
                    gc.collect()
    except Exception:
        pass
        
    # 2. Check CPU Load / Thermal Protection
    try:
        if os.path.exists('/proc/loadavg'):
            with open('/proc/loadavg', 'r') as f:
                content = f.read().strip()
            load_1 = float(content.split()[0])
            cores = os.cpu_count() or 4
            
            if load_1 > (cores * 0.9):
                sleep_time = min(max(int(load_1 - cores * 0.9) + 2, 2), 10)
                add_log_fn(f"[Resource Guard] CPU Load is high ({load_1:.2f} avg on {cores} cores). Pausing {sleep_time}s to cool down CPU...")
                time.sleep(sleep_time)
            else:
                # Rest CPU briefly between batches
                time.sleep(1.5)
        else:
            time.sleep(1.5)
    except Exception:
        time.sleep(1.5)


def run_local_tts_subprocess(segments: list[dict[str, Any]], version: str, cpu_threads: int, cache_dir: str):
    try:
        from backend.config import load_config, MODELS_DIR, add_log

        config = load_config()
    except Exception:
        config = {}
        MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "downloads", "models")
        def add_log(msg): print(msg)

    # Filter out segments that are already cached to avoid starting subprocesses for empty batches
    uncached_segments = []
    for seg in segments:
        out_path = seg.get("output_path")
        if out_path and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            continue
        uncached_segments.append(seg)
        
    if not uncached_segments:
        return

    # Split into batches of at most vieneu_subprocess_batch_size to avoid memory accumulation/leaks and keep RAM usage low.
    sub_batch_size = int(config.get("vieneu_subprocess_batch_size", 12) or 12)

    # Resolve VieNeu paths based on version (v2 or v3)
    if version == "v2":
        v2_dir = config.get("vieneu_onnx_dir") or os.environ.get("VIENEU_ONNX_DIR", "")
        if not v2_dir:
            v2_dir = os.path.join(MODELS_DIR, "vieneu", "v2")
        
        gguf_path = os.path.join(v2_dir, "vieneu-tts-v2-turbo.gguf")
        dec_path = os.path.join(v2_dir, "codec", "vieneu_decoder.onnx")
        
        vieneu_onnx_dir = gguf_path if os.path.exists(gguf_path) else v2_dir
        vieneu_codec_dir = dec_path if os.path.exists(dec_path) else os.path.join(v2_dir, "codec")
    else:
        # Resolve VieNeu ONNX dir dynamically
        vieneu_onnx_dir = config.get("vieneu_onnx_dir") or os.environ.get("VIENEU_ONNX_DIR", "")
        if not vieneu_onnx_dir:
            base_onnx = os.path.join(MODELS_DIR, "vieneu", "onnx")
            nested_onnx = os.path.join(base_onnx, "onnx")
            if os.path.exists(nested_onnx) and len(os.listdir(nested_onnx)) > 0:
                vieneu_onnx_dir = nested_onnx
            else:
                vieneu_onnx_dir = base_onnx

        # Resolve VieNeu Codec dir dynamically
        vieneu_codec_dir = config.get("vieneu_codec_dir") or os.environ.get("VIENEU_CODEC_DIR", "")
        if not vieneu_codec_dir:
            vieneu_codec_dir = os.path.join(MODELS_DIR, "vieneu", "codec")

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    script_path = os.path.join(base_dir, "backend", "tts_subprocess.py")

    total_uncached = len(uncached_segments)
    num_batches = -(-total_uncached // sub_batch_size) # ceiling division
    
    from concurrent.futures import ThreadPoolExecutor
    
    # Run sequentially (max_workers=1) to guarantee memory safety and prevent CPU freezes
    max_workers = 1
    
    def process_batch(batch_info):
        batch_idx, start_idx = batch_info
        batch_segs = uncached_segments[start_idx : start_idx + sub_batch_size]
        add_log(f"Starting VieNeu-TTS subprocess batch {batch_idx + 1}/{num_batches} ({len(batch_segs)} segments)...")
        
        temp_json_name = f"temp_tts_task_{uuid.uuid4().hex}.json"
        temp_json_path = os.path.join(cache_dir, temp_json_name)

        task_data = {
            "version": version,
            "cpu_threads": cpu_threads,
            "vieneu_mode": config.get("vieneu_mode", "local"),
            "vieneu_api_base": config.get("vieneu_api_base", "http://localhost:23333/v1"),
            "vieneu_model_name": config.get("vieneu_model_name", "pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF" if version == "v2" else "pnnbao-ump/VieNeu-TTS-v3-Turbo"),
            "vieneu_onnx_dir": vieneu_onnx_dir,
            "vieneu_codec_dir": vieneu_codec_dir,
            "hf_offline": bool(config.get("vieneu_hf_offline", True)),
            "start_segment_index": start_idx,
            "total_segments_count": total_uncached,
            "segments": batch_segs,
        }

        try:
            os.makedirs(cache_dir, exist_ok=True)
            with open(temp_json_path, "w", encoding="utf-8") as f:
                json.dump(task_data, f, indent=4, ensure_ascii=False)

            process = subprocess.Popen(
                ["python3", "-u", script_path, temp_json_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            stdout_lines = []
            if process.stdout:
                for line in process.stdout:
                    cleaned_line = line.strip()
                    if cleaned_line:
                        add_log(f"VieNeu-TTS Batch {batch_idx + 1}: {cleaned_line}")
                        stdout_lines.append(cleaned_line)

            process.wait()
            if process.returncode != 0:
                raise RuntimeError(
                    f"VieNeu-TTS subprocess batch {batch_idx + 1} failed with code {process.returncode}.\n"
                    f"Log output:\n{chr(10).join(stdout_lines)}"
                )
            
            check_resources_and_cool_down(add_log)
        finally:
            if os.path.exists(temp_json_path):
                try:
                    os.remove(temp_json_path)
                except Exception:
                    pass

    batch_infos = [(idx, start_idx) for idx, start_idx in enumerate(range(0, total_uncached, sub_batch_size))]
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        list(executor.map(process_batch, batch_infos))


def synthesize_google_tts(client, text: str, voice_name: str, rate: float, ssml_capable: bool, output_path: str):
    from google.api_core.exceptions import GoogleAPICallError
    from google.cloud import texttospeech

    parts = voice_name.split("-")
    lang_code = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else "en-US"

    if ssml_capable:
        wrapped_ssml = f"<speak><prosody rate='{int(rate * 100)}%'>{text}</prosody></speak>"
        if "Studio" in voice_name:
            wrapped_ssml = clean_for_studio(wrapped_ssml)
        synthesis_input = texttospeech.SynthesisInput(ssml=wrapped_ssml)
    else:
        synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(language_code=lang_code, name=voice_name)
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=rate,
        pitch=0.0,
    )

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )
            with open(output_path, "wb") as out:
                out.write(response.audio_content)
            return
        except GoogleAPICallError:
            if attempt == max_retries - 1:
                raise
            time.sleep(2**attempt)
        except Exception:
            if attempt == max_retries - 1:
                raise
            time.sleep(2**attempt)

    raise RuntimeError("Failed to synthesize text via Google Cloud TTS")


def synthesize_segment(client, segment: dict[str, Any], cache_dir: str) -> str:
    try:
        from backend.config import load_config

        config = load_config()
    except Exception:
        config = {}

    voice_name = segment["voice_name"]
    rate = float(segment.get("rate", 1.0) or 1.0)
    ssml_capable = bool(segment.get("ssml_capable", False))
    provider = get_voice_provider(voice_name)
    text = prepare_segment_text(segment, config)
    output_path = get_cached_output_path(segment, cache_dir, config)

    os.makedirs(cache_dir, exist_ok=True)
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        return output_path

    if provider == "vieneu":
        run_local_tts_subprocess(
            [{"text": text, "voice_name": voice_name, "rate": rate, "output_path": output_path}],
            version=config.get("vieneu_version", "v3"),
            cpu_threads=int(config.get("cpu_threads", 0) or 0),
            cache_dir=cache_dir,
        )
        return output_path

    if provider == "fish":
        audio_bytes = synthesize_fish_speech(text, voice_name, rate, config)
    elif provider == "omnivoice":
        audio_bytes = synthesize_omnivoice_api(text, voice_name, rate, config)
    elif provider == "generic":
        audio_bytes = synthesize_generic_tts(text, voice_name, rate, config)
    else:
        if client is None:
            raise RuntimeError("Google Cloud TTS client is not initialized.")
        synthesize_google_tts(client, text, voice_name, rate, ssml_capable, output_path)
        return output_path

    with open(output_path, "wb") as f:
        f.write(audio_bytes)
    return output_path


def build_vieneu_subprocess_tasks(
    segments: list[dict[str, Any]],
    cache_dir: str,
    config: dict[str, Any],
) -> list[tuple[int, dict[str, Any], str, str]]:
    tasks = []
    for idx, seg in enumerate(segments):
        if get_voice_provider(seg["voice_name"]) != "vieneu":
            continue
        clean_text = prepare_segment_text(seg, config)
        output_path = get_cached_output_path(seg, cache_dir, config)
        tasks.append((idx, seg, clean_text, output_path))
    return tasks


def list_all_available_voices(creds_path: str) -> dict[str, list[dict[str, Any]]]:
    grouped_voices: dict[str, list[dict[str, Any]]] = {}

    try:
        client = init_tts_client(creds_path)
        response = client.list_voices()
        for voice in response.voices:
            if not any(tag in voice.name for tag in ["Wavenet", "Neural2", "Studio"]):
                continue
            for lang_code in voice.language_codes:
                label = lang_code
                lower_code = lang_code.lower()
                if "en-us" in lower_code:
                    label = "en-US (United States)"
                elif "en-gb" in lower_code:
                    label = "en-GB (United Kingdom)"
                elif "vi-vn" in lower_code:
                    label = "vi-VN (Vietnam)"
                elif "zh-cn" in lower_code:
                    label = "zh-CN (China)"
                elif "ja-jp" in lower_code:
                    label = "ja-JP (Japan)"
                grouped_voices.setdefault(label, []).append(
                    {
                        "name": voice.name,
                        "gender": voice.ssml_gender.name,
                        "provider": "google",
                        "requires_remote": False,
                    }
                )
        for voices in grouped_voices.values():
            voices.sort(key=lambda x: x["name"])
    except Exception:
        grouped_voices = {
            group: [
                {**voice, "provider": "google", "requires_remote": False}
                for voice in voices
            ]
            for group, voices in FALLBACK_GOOGLE_VOICES.items()
        }

    try:
        from backend.config import load_config

        config = load_config()
        version = config.get("vieneu_version", "v3")
    except Exception:
        version = "v3"

    local_voices = VIENEU_V3_VOICES if version == "v3" else VIENEU_V2_VOICES
    grouped_voices["vi-VN (Local - VieNeu-TTS)"] = [
        {
            "name": name,
            "gender": "FEMALE" if "nữ" in desc.lower() else "MALE",
            "description": desc,
            "provider": "vieneu",
            "requires_remote": False,
            "expression_tags": VIENEU_EXPRESSION_TAGS,
        }
        for name, desc in local_voices.items()
    ]

    grouped_voices["vi-VN / en-US (Remote - Fish Speech)"] = [
        {
            "name": "Fish-Speech (Default)",
            "gender": "FEMALE",
            "description": "Remote Fish Speech API voice",
            "provider": "fish",
            "requires_remote": True,
            "expression_tags": FISH_EXPRESSION_TAGS,
            "setup_instructions": "Run Fish Speech on a GPU machine and configure /v1/tts in Settings.",
        },
        {
            "name": "Fish-Speech (Cloned)",
            "gender": "FEMALE",
            "description": "Remote Fish Speech cloned/reference voice",
            "provider": "fish",
            "requires_remote": True,
            "expression_tags": FISH_EXPRESSION_TAGS,
            "setup_instructions": "Run Fish Speech on a GPU machine and configure /v1/tts plus reference audio or ID.",
        },
    ]

    grouped_voices["vi-VN / en-US (Remote - OmniVoice)"] = [
        {
            "name": "OmniVoice (Designed)",
            "gender": "FEMALE",
            "description": "Remote OmniVoice/OpenAI-compatible designed voice",
            "provider": "omnivoice",
            "requires_remote": True,
            "expression_tags": OMNIVOICE_EXPRESSION_TAGS,
            "setup_instructions": "Run OmniVoice on a GPU machine behind an OpenAI-compatible /v1/audio/speech adapter.",
        },
        {
            "name": "OmniVoice (Cloned)",
            "gender": "FEMALE",
            "description": "Remote OmniVoice/OpenAI-compatible cloned voice",
            "provider": "omnivoice",
            "requires_remote": True,
            "expression_tags": OMNIVOICE_EXPRESSION_TAGS,
            "setup_instructions": "Run OmniVoice on a GPU machine and configure a remote voice/reference in Settings.",
        },
    ]

    grouped_voices["Custom (Remote API TTS)"] = [
        {
            "name": "Generic API TTS",
            "gender": "NEUTRAL",
            "description": "OpenAI-compatible remote TTS endpoint",
            "provider": "generic",
            "requires_remote": True,
            "setup_instructions": "Configure a compatible /v1/audio/speech endpoint, model, voice, and API key.",
        }
    ]
    return grouped_voices
