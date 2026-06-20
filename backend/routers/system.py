import os
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.config import log_buffer, load_config

router = APIRouter(tags=["system"])

async def get_top_processes():
    """Retrieves top CPU-consuming processes asynchronously using Linux ps."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ps", "-eo", "pid,comm,%cpu,%mem", "--sort=-%cpu",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        lines = stdout.decode("utf-8").strip().split("\n")
        processes = []
        for line in lines[1:11]:  # Top 10 processes
            parts = line.strip().split()
            if len(parts) >= 4:
                processes.append({
                    "pid": parts[0],
                    "name": parts[1],
                    "cpu": float(parts[2]),
                    "mem": float(parts[3])
                })
        return processes
    except Exception as e:
        print(f"Error fetching top processes: {e}")
        return []

@router.get("/api/system-status")
async def get_system_status():
    """Returns CPU load, Memory usage, Disk utilization, and Top processes."""
    # 1. CPU Load
    try:
        def parse_stat():
            with open("/proc/stat", "r") as f:
                for line in f:
                    if line.startswith("cpu "):
                        fields = [float(x) for x in line.strip().split()[1:]]
                        idle = fields[3] + fields[4]
                        total = sum(fields)
                        return idle, total
            return 0, 0
        
        idle1, total1 = parse_stat()
        await asyncio.sleep(0.1)
        idle2, total2 = parse_stat()
        
        idle_delta = idle2 - idle1
        total_delta = total2 - total1
        cpu_percent = (1.0 - idle_delta / total_delta) * 100.0 if total_delta > 0 else 0.0
    except Exception:
        cpu_percent = 0.0

    # 2. Memory Usage
    try:
        meminfo = {}
        with open("/proc/meminfo", "r") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2:
                    meminfo[parts[0].rstrip(":")] = int(parts[1]) * 1024
        mem_total = meminfo.get("MemTotal", 0)
        mem_free = meminfo.get("MemFree", 0)
        mem_buffers = meminfo.get("Buffers", 0)
        mem_cached = meminfo.get("Cached", 0) + meminfo.get("SReclaimable", 0)
        mem_used = mem_total - mem_free - mem_buffers - mem_cached
        mem_percent = (mem_used / mem_total * 100.0) if mem_total > 0 else 0.0
    except Exception:
        mem_total = mem_used = mem_percent = 0.0

    # 3. Disk Utilization
    try:
        st = os.statvfs("/")
        disk_free = st.f_bavail * st.f_frsize
        disk_total = st.f_blocks * st.f_frsize
        disk_used = disk_total - disk_free
        disk_percent = (disk_used / disk_total * 100.0) if disk_total > 0 else 0.0
    except Exception:
        disk_total = disk_used = disk_percent = 0.0

    # 4. Top Processes
    top_processes = await get_top_processes()

    return {
        "cpu": {
            "percent": round(cpu_percent, 1)
        },
        "memory": {
            "total": mem_total,
            "used": mem_used,
            "percent": round(mem_percent, 1)
        },
        "disk": {
            "total": disk_total,
            "used": disk_used,
            "percent": round(disk_percent, 1)
        },
        "processes": top_processes
    }


@router.get("/api/webgpu-capabilities")
async def get_webgpu_capabilities():
    config = load_config()
    return {
        "enabled": bool(config.get("webgpu_enabled", True)),
        "tts_enabled": bool(config.get("webgpu_tts_enabled", False)),
        "model_assets_required": True,
        "auto_downloads": False,
    }

class WebGpuProbeResult(BaseModel):
    supported: bool
    vendor: str | None = None
    architecture: str | None = None
    maxBufferSize: int | None = None
    maxComputeWorkgroupSizeX: int | None = None
    reason: str | None = None

webgpu_probe_cache = {}

@router.post("/api/webgpu/probe-results")
async def post_webgpu_probe_results(req: WebGpuProbeResult):
    global webgpu_probe_cache
    webgpu_probe_cache = req.model_dump()
    return {"status": "ok", "probe": webgpu_probe_cache}

@router.get("/api/models/manifest")
async def get_model_manifest():
    from backend.config import MODELS_DIR, load_config
    config = load_config()
    
    version = config.get("vieneu_version", "v2")
    if version == "v2":
        v2_dir = config.get("vieneu_onnx_dir") or os.path.join(MODELS_DIR, "vieneu", "v2")
        gguf_path = os.path.join(v2_dir, "vieneu-tts-v2-turbo.gguf")
        codec_dir = config.get("vieneu_codec_dir") or os.path.join(v2_dir, "codec")
        dec_path = os.path.join(codec_dir, "vieneu_decoder.onnx")
        
        onnx_downloaded = os.path.exists(gguf_path) and os.path.getsize(gguf_path) > 0
        codec_downloaded = os.path.exists(dec_path) and os.path.getsize(dec_path) > 0
        resolved_onnx_dir = gguf_path
    else:
        # Check VieNeu
        onnx_dir = config.get("vieneu_onnx_dir") or os.path.join(MODELS_DIR, "vieneu", "onnx")
        resolved_onnx_dir = onnx_dir
        if not config.get("vieneu_onnx_dir"):
            nested_onnx = os.path.join(onnx_dir, "onnx")
            if os.path.exists(nested_onnx) and len(os.listdir(nested_onnx)) > 0:
                resolved_onnx_dir = nested_onnx

        codec_dir = config.get("vieneu_codec_dir") or os.path.join(MODELS_DIR, "vieneu", "codec")
        onnx_downloaded = os.path.exists(resolved_onnx_dir) and len(os.listdir(resolved_onnx_dir)) > 0 if os.path.exists(resolved_onnx_dir) else False
        codec_downloaded = os.path.exists(codec_dir) and len(os.listdir(codec_dir)) > 0 if os.path.exists(codec_dir) else False
    
    # Check ASR (Whisper)
    from backend.providers.asr import managed_model_path
    managed_dir = managed_model_path(config)
    managed_name = config.get("asr_managed_model_name", "Systran/faster-whisper-small")
    asr_downloaded = os.path.exists(managed_dir) and len(os.listdir(managed_dir)) > 0 if os.path.exists(managed_dir) else False
    
    vieneu_onnx_name = "VieNeu v2 GGUF Model" if version == "v2" else "VieNeu ONNX Models"
    vieneu_onnx_req = ["CPU", "GPU (llama.cpp)"] if version == "v2" else ["CPU", "WebGPU"]
    vieneu_onnx_size = "450 MB" if version == "v2" else "2.1 GB"
    
    vieneu_codec_name = "VieNeu v2 Codec Model" if version == "v2" else "VieNeu Codec Model"
    vieneu_codec_size = "80 MB" if version == "v2" else "150 MB"
    
    return {
        "models": [
            {
                "id": "vieneu_onnx",
                "name": vieneu_onnx_name,
                "type": "tts",
                "requirements": vieneu_onnx_req,
                "estimated_size": vieneu_onnx_size,
                "downloaded": onnx_downloaded,
                "path": resolved_onnx_dir
            },
            {
                "id": "vieneu_codec",
                "name": vieneu_codec_name,
                "type": "tts",
                "requirements": ["CPU"],
                "estimated_size": vieneu_codec_size,
                "downloaded": codec_downloaded,
                "path": codec_dir
            },
            {
                "id": "faster_whisper",
                "name": f"faster-whisper ({managed_name})",
                "type": "asr",
                "requirements": ["CPU", "CUDA/GPU"],
                "estimated_size": "460 MB",
                "downloaded": asr_downloaded,
                "path": managed_dir
            }
        ]
    }


class ModelDownloadRequest(BaseModel):
    model_id: str


@router.post("/api/models/download")
def download_model_endpoint(req: ModelDownloadRequest):
    """Downloads model files for local VieNeu-TTS from Hugging Face."""
    from fastapi import HTTPException
    from huggingface_hub import hf_hub_download
    import shutil
    from backend.config import MODELS_DIR, load_config
    
    config = load_config()
    version = config.get("vieneu_version", "v2")
    
    model_id = req.model_id
    try:
        if model_id == "vieneu_onnx":
            if version == "v2":
                onnx_target_dir = os.path.join(MODELS_DIR, "vieneu", "v2")
                os.makedirs(onnx_target_dir, exist_ok=True)
                repo = "pnnbao-ump/VieNeu-TTS-v2-Turbo-GGUF"
                files = ["vieneu-tts-v2-turbo.gguf", "voices.json"]
                for fn in files:
                    temp_path = hf_hub_download(repo, fn, repo_type="model")
                    dest_name = os.path.basename(fn)
                    dest_path = os.path.join(onnx_target_dir, dest_name)
                    shutil.copy2(temp_path, dest_path)
                return {"status": "downloaded", "path": onnx_target_dir}
            else:
                onnx_target_dir = os.path.join(MODELS_DIR, "vieneu", "onnx")
                os.makedirs(onnx_target_dir, exist_ok=True)
                repo = "pnnbao-ump/VieNeu-TTS-v3-Turbo"
                files = [
                    "onnx/vieneu_prefill.onnx", 
                    "onnx/vieneu_decode_step.onnx",
                    "onnx/vieneu_acoustic_cached.onnx", 
                    "onnx/vieneu_backbone_shared.data",
                    "onnx/vieneu_v3_heads.npz",
                    "config.json",
                    "tokenizer.json"
                ]
                for fn in files:
                    temp_path = hf_hub_download(repo, fn, repo_type="model")
                    dest_name = os.path.basename(fn)
                    dest_path = os.path.join(onnx_target_dir, dest_name)
                    shutil.copy2(temp_path, dest_path)
                return {"status": "downloaded", "path": onnx_target_dir}
            
        elif model_id == "vieneu_codec":
            if version == "v2":
                codec_target_dir = os.path.join(MODELS_DIR, "vieneu", "v2", "codec")
                os.makedirs(codec_target_dir, exist_ok=True)
                repo = "pnnbao-ump/VieNeu-Codec"
                files = ["vieneu_decoder.onnx", "vieneu_encoder.onnx"]
                for fn in files:
                    temp_path = hf_hub_download(repo, fn, repo_type="model")
                    dest_name = os.path.basename(fn)
                    dest_path = os.path.join(codec_target_dir, dest_name)
                    shutil.copy2(temp_path, dest_path)
                return {"status": "downloaded", "path": codec_target_dir}
            else:
                codec_target_dir = os.path.join(MODELS_DIR, "vieneu", "codec")
                os.makedirs(codec_target_dir, exist_ok=True)
                repo = "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"
                files = [
                    "moss_audio_tokenizer_decode_full.onnx", 
                    "moss_audio_tokenizer_decode_shared.data",
                    "moss_audio_tokenizer_encode.onnx", 
                    "moss_audio_tokenizer_encode.data",
                ]
                for fn in files:
                    temp_path = hf_hub_download(repo, fn, repo_type="model")
                    dest_name = os.path.basename(fn)
                    dest_path = os.path.join(codec_target_dir, dest_name)
                    shutil.copy2(temp_path, dest_path)
                return {"status": "downloaded", "path": codec_target_dir}
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported model ID: {model_id}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model download failed: {e}")

@router.get("/api/logs")
async def stream_logs():
    """SSE endpoint to stream real-time logs to the WebUI."""
    async def log_generator():
        last_idx = 0
        while True:
            if last_idx < len(log_buffer):
                for i in range(last_idx, len(log_buffer)):
                    yield f"data: {log_buffer[i]}\n\n"
                last_idx = len(log_buffer)
            await asyncio.sleep(0.2)
    return StreamingResponse(log_generator(), media_type="text/event-stream")
