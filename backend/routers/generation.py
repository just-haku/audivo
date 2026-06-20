import os
import re
import json
import threading
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from backend.config import CREDS_PATH, GENERATED_DIR, CACHE_DIR, VIDEOS_DIR, MUSIC_DIR, SUBTITLES_DIR, add_log, load_config
from backend.tts import (
    build_vieneu_subprocess_tasks,
    get_optimal_workers,
    get_voice_provider,
    init_tts_client,
    parse_script,
    run_local_tts_subprocess,
    split_text_into_sentences,
    synthesize_segment,
)
from backend.editor import get_media_duration, generate_ass_from_asr, compose_final_video
from backend.providers.asr import transcribe_audio
from backend.jobs import JobManager, JobType, JobStatus

router = APIRouter(tags=["generation"])
job_manager = JobManager()

class ConvertXmlRequest(BaseModel):
    text: str
    default_voice: str

class GenerateRequest(BaseModel):
    script: str
    default_voice: str
    video_materials: list[str]
    bg_music: list[str] | str | None = None
    bg_music_volume: float = 0.2
    video_speed: float = 1.0
    aspect_ratio: str = "9:16"
    mute_video: bool = True
    video_order_mode: str = "ordered"
    vieneu_batch_paragraphs: int = 1
    asr_provider: str | None = None
    subtitle_timing_source: str | None = None
    subtitle_fallback_to_estimated: bool | None = None
    review_subtitles: bool = False
    
    subtitle_font: str = "Arial"
    subtitle_font_size: int = 48
    subtitle_color: str = "#FFFFFF"
    subtitle_outline_color: str = "#000000"
    subtitle_outline_width: int = 3
    subtitle_back_color: str = "#000000"
    subtitle_shadow_depth: int = 0
    subtitle_bold: bool = True
    subtitle_italic: bool = False
    subtitle_margin_v: int | None = None

    # Phase 3 template features
    intro_template: str | None = None
    outro_template: str | None = None
    watermark_path: str | None = None
    watermark_position: str = "bottom-right"
    watermark_opacity: float = 0.7

class SubtitleReviewRequest(BaseModel):
    cues: list[dict]

class AiScriptRequest(BaseModel):
    topic: str
    language: str
    tts_type: str
    provider: str = "gemini"
    model: str | None = None
    default_voice: str = "en-US-Neural2-F"

def get_estimated_cues(segments):
    cues = []
    current_time = 0.0
    for seg in segments:
        text = seg["text"].strip()
        duration = seg["duration"]
        cues.append({
            "start": current_time,
            "end": current_time + duration,
            "text": text
        })
        current_time += duration
    return cues

def run_generation_pipeline(job_id: str, cancel_event: threading.Event, req: GenerateRequest):
    import traceback
    try:
        add_log("--- Starting Video Generation Pipeline ---")
        config = load_config()
        
        if cancel_event.is_set(): return
        job_manager.update_job_progress(job_id, 10)
        
        add_log("Parsing script and dividing sentences...")
        vieneu_batch = min(max(int(req.vieneu_batch_paragraphs or config.get("vieneu_batch_paragraphs", 1)), 1), 20)
        segments = parse_script(req.script, req.default_voice, vieneu_batch_paragraphs=vieneu_batch)
        if not segments:
            raise ValueError("No text found in the script")
        add_log(f"Divided script into {len(segments)} sentence segments.")
        
        if cancel_event.is_set(): return
        job_manager.update_job_progress(job_id, 25)
        
        has_google_voice = any(get_voice_provider(seg["voice_name"]) == "google" for seg in segments)
        tts_client = None
        if has_google_voice:
            add_log("Initializing Google Cloud TTS Client...")
            tts_client = init_tts_client(CREDS_PATH)
                
        local_segments_to_synth = build_vieneu_subprocess_tasks(segments, CACHE_DIR, config)
        if local_segments_to_synth:
            add_log(f"Synthesizing {len(local_segments_to_synth)} local VieNeu-TTS segment(s)...")
            sub_segs = []
            for idx, seg, clean_text, output_path in local_segments_to_synth:
                if not (os.path.exists(output_path) and os.path.getsize(output_path) > 0):
                    sub_segs.append({
                        "text": clean_text,
                        "voice_name": seg["voice_name"],
                        "rate": seg["rate"],
                        "output_path": output_path
                    })
            
            if sub_segs:
                cpu_threads = config.get("cpu_threads", 0)
                run_local_tts_subprocess(sub_segs, version=config.get("vieneu_version", "v3"), cpu_threads=cpu_threads, cache_dir=CACHE_DIR)
                
            for idx, seg, clean_text, output_path in local_segments_to_synth:
                if cancel_event.is_set(): return
                seg["audio_path"] = output_path
                dur = get_media_duration(output_path)
                if dur <= 0:
                    raise ValueError(f"Failed to read audio length of local segment {idx}")
                seg["duration"] = dur
                
        remote_or_google_segments = [
            (idx, seg)
            for idx, seg in enumerate(segments)
            if get_voice_provider(seg["voice_name"]) != "vieneu"
        ]
        if remote_or_google_segments:
            add_log(f"Synthesizing {len(remote_or_google_segments)} cloud/remote TTS segment(s)...")
            num_workers = get_optimal_workers()
            from concurrent.futures import ThreadPoolExecutor
            
            def tts_worker(item):
                if cancel_event.is_set(): return
                idx, seg = item
                provider = get_voice_provider(seg["voice_name"])
                add_log(f"  Synthesizing {provider} segment {idx+1}/{len(segments)}")
                audio_path = synthesize_segment(tts_client, seg, CACHE_DIR)
                seg["audio_path"] = audio_path
                dur = get_media_duration(audio_path)
                if dur <= 0:
                    raise ValueError(f"Failed to read audio length of {provider} segment {idx}")
                seg["duration"] = dur
                
            with ThreadPoolExecutor(max_workers=num_workers) as executor:
                list(executor.map(tts_worker, remote_or_google_segments))
                
        add_log("Voiceover synthesis completed.")
        
        if cancel_event.is_set(): return
        job_manager.update_job_progress(job_id, 50)
        
        os.makedirs(SUBTITLES_DIR, exist_ok=True)
        subtitle_source = req.subtitle_timing_source or config.get("subtitle_timing_source", "asr")
        fallback_to_estimated = config.get("subtitle_fallback_to_estimated", True)
        if req.subtitle_fallback_to_estimated is not None:
            fallback_to_estimated = req.subtitle_fallback_to_estimated

        cues = []
        if subtitle_source == "asr":
            try:
                voiceover_for_asr = os.path.join(SUBTITLES_DIR, f"voiceover_{job_id}.mp3")
                
                # Chunked batch concatenation to prevent OOM
                def concatenate_audio_segments_local(segs, out_path, batch_size=100):
                    from pydub import AudioSegment
                    import gc
                    import subprocess
                    
                    temp_batches = []
                    tmp_dir = os.path.dirname(out_path)
                    os.makedirs(tmp_dir, exist_ok=True)
                    
                    for i in range(0, len(segs), batch_size):
                        batch_segs = segs[i : i + batch_size]
                        combined = AudioSegment.empty()
                        for s in batch_segs:
                            audio_p = s.get("audio_path")
                            if not audio_p or not os.path.exists(audio_p):
                                continue
                            combined += AudioSegment.from_file(audio_p)
                        
                        if len(combined) > 0:
                            batch_p = os.path.join(tmp_dir, f"temp_batch_{i}_{os.path.basename(out_path)}")
                            combined.export(batch_p, format="mp3", bitrate="192k")
                            temp_batches.append(batch_p)
                            
                        del combined
                        gc.collect()
                        
                    if not temp_batches:
                        raise ValueError("No audio segments were successfully concatenated")
                        
                    if len(temp_batches) == 1:
                        if os.path.exists(out_path):
                            os.remove(out_path)
                        os.rename(temp_batches[0], out_path)
                        return
                        
                    list_p = os.path.join(tmp_dir, f"list_{os.path.basename(out_path)}.txt")
                    with open(list_p, "w", encoding="utf-8") as f:
                        for p in temp_batches:
                            f.write(f"file '{os.path.abspath(p)}'\n")
                            
                    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_p, "-c", "copy", out_path]
                    try:
                        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                    finally:
                        if os.path.exists(list_p):
                            os.remove(list_p)
                        for p in temp_batches:
                            if os.path.exists(p):
                                try: os.remove(p)
                                except Exception: pass

                concatenate_audio_segments_local(segments, voiceover_for_asr)
                language = "vi-VN" if any(get_voice_provider(seg["voice_name"]) == "vieneu" for seg in segments) else None
                add_log(f"Generating ASR timestamps via {req.asr_provider or config.get('asr_provider', 'remote_openai')}...")
                cues = transcribe_audio(voiceover_for_asr, config, language=language, provider=req.asr_provider)
                add_log("ASR subtitles generated successfully.")
            except Exception as asr_err:
                if not fallback_to_estimated:
                    raise
                add_log(f"Warning: ASR subtitle generation failed: {asr_err}. Falling back to estimated timing.")
                cues = get_estimated_cues(segments)
        else:
            cues = get_estimated_cues(segments)
            
        if req.review_subtitles:
            result = {
                "subtitle_cues": cues,
                "segments": segments,
                "req": req.dict()
            }
            job_manager.update_job_status(job_id, JobStatus.AWAITING_REVIEW, result=result)
            add_log("Pipeline paused. Awaiting subtitle review.")
            return result

        is_portrait = req.aspect_ratio == "9:16"
        width = 1080 if is_portrait else 1920
        height = 1920 if is_portrait else 1080
        
        sub_style = {
            "font_name": req.subtitle_font,
            "font_size": req.subtitle_font_size,
            "primary_color": req.subtitle_color,
            "outline_color": req.subtitle_outline_color,
            "outline_width": req.subtitle_outline_width,
            "back_color": req.subtitle_back_color,
            "shadow_depth": req.subtitle_shadow_depth,
            "bold": req.subtitle_bold,
            "italic": req.subtitle_italic,
            "alignment": 2,
            "width": width,
            "height": height,
            "aspect_ratio": req.aspect_ratio,
            "margin_v": req.subtitle_margin_v or (180 if is_portrait else 60),
            "max_chars": config.get("subtitle_max_chars", 42),
            "max_duration": config.get("subtitle_max_duration", 4.0),
            "min_duration": config.get("subtitle_min_duration", 0.8)
        }
        
        subtitles_path = os.path.join(SUBTITLES_DIR, f"subtitles_{job_id}.ass")
        generate_ass_from_asr(cues, subtitles_path, sub_style)
        
        if cancel_event.is_set(): return
        job_manager.update_job_progress(job_id, 70)
        
        video_paths = [os.path.join(VIDEOS_DIR, name) for name in req.video_materials]
        bg_music_paths = []
        if req.bg_music:
            if isinstance(req.bg_music, list):
                bg_music_paths = [os.path.join(MUSIC_DIR, name) for name in req.bg_music if name]
            elif isinstance(req.bg_music, str):
                bg_music_paths = [os.path.join(MUSIC_DIR, req.bg_music)]
        
        add_log("Starting video assembly...")
        final_video_path = compose_final_video(
            segments=segments,
            video_materials=video_paths,
            bg_music_paths=bg_music_paths,
            bg_music_volume=req.bg_music_volume,
            video_speed=req.video_speed,
            subtitles_path=subtitles_path,
            output_dir=GENERATED_DIR,
            style=sub_style,
            mute_video=req.mute_video,
            video_order_mode=req.video_order_mode,
            log_callback=add_log
        )
        
        # Post-processing intro, outro, watermark
        try:
            from backend.templates import apply_intro, apply_outro, apply_watermark
            processed_video_path = final_video_path
            if req.intro_template:
                add_log(f"Applying intro template: {req.intro_template}")
                processed_video_path = apply_intro(processed_video_path, req.intro_template)
            if req.outro_template:
                add_log(f"Applying outro template: {req.outro_template}")
                processed_video_path = apply_outro(processed_video_path, req.outro_template)
            if req.watermark_path:
                add_log(f"Applying watermark: {req.watermark_path} at {req.watermark_position} with opacity {req.watermark_opacity}")
                processed_video_path = apply_watermark(processed_video_path, req.watermark_path, position=req.watermark_position, opacity=req.watermark_opacity)
            final_video_path = processed_video_path
        except Exception as pe:
            add_log(f"Warning: Failed to apply intro/outro/watermark: {pe}")
            
        video_filename = os.path.basename(final_video_path)
        try:
            meta_path = os.path.splitext(final_video_path)[0] + ".json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(req.dict(), f, indent=4)
        except Exception as me:
            add_log(f"Warning: Failed to save video metadata: {me}")
        add_log(f"[GEN_SUCCESS] {video_filename}")
        return {"video_filename": video_filename}
        
    except Exception as e:
        add_log(f"[GEN_ERROR] Generation failed: {str(e)}")
        add_log(traceback.format_exc())
        raise

def resume_generation_pipeline(job_id: str, cancel_event: threading.Event, edited_cues: list):
    import traceback
    try:
        job = job_manager.get_job(job_id)
        result_data = job["result"]
        segments = result_data["segments"]
        req = GenerateRequest(**result_data["req"])
        config = load_config()
        
        add_log("Creating subtitles from edited cues...")
        is_portrait = req.aspect_ratio == "9:16"
        sub_style = {
            "font_name": req.subtitle_font,
            "font_size": req.subtitle_font_size,
            "primary_color": req.subtitle_color,
            "outline_color": req.subtitle_outline_color,
            "outline_width": req.subtitle_outline_width,
            "back_color": req.subtitle_back_color,
            "shadow_depth": req.subtitle_shadow_depth,
            "bold": req.subtitle_bold,
            "italic": req.subtitle_italic,
            "alignment": 2,
            "width": 1080 if is_portrait else 1920,
            "height": 1920 if is_portrait else 1080,
            "aspect_ratio": req.aspect_ratio,
            "margin_v": req.subtitle_margin_v or (180 if is_portrait else 60),
            "max_chars": config.get("subtitle_max_chars", 42),
            "max_duration": config.get("subtitle_max_duration", 4.0),
            "min_duration": config.get("subtitle_min_duration", 0.8)
        }
        
        subtitles_path = os.path.join(SUBTITLES_DIR, f"subtitles_{job_id}.ass")
        generate_ass_from_asr(edited_cues, subtitles_path, sub_style)
        
        if cancel_event.is_set(): return
        job_manager.update_job_progress(job_id, 80)
        
        video_paths = [os.path.join(VIDEOS_DIR, name) for name in req.video_materials]
        bg_music_paths = []
        if req.bg_music:
            if isinstance(req.bg_music, list):
                bg_music_paths = [os.path.join(MUSIC_DIR, name) for name in req.bg_music if name]
            elif isinstance(req.bg_music, str):
                bg_music_paths = [os.path.join(MUSIC_DIR, req.bg_music)]
                
        add_log("Starting video assembly...")
        final_video_path = compose_final_video(
            segments=segments,
            video_materials=video_paths,
            bg_music_paths=bg_music_paths,
            bg_music_volume=req.bg_music_volume,
            video_speed=req.video_speed,
            subtitles_path=subtitles_path,
            output_dir=GENERATED_DIR,
            style=sub_style,
            mute_video=req.mute_video,
            video_order_mode=req.video_order_mode,
            log_callback=add_log
        )
        
        # Post-processing intro, outro, watermark
        try:
            from backend.templates import apply_intro, apply_outro, apply_watermark
            processed_video_path = final_video_path
            if req.intro_template:
                add_log(f"Applying intro template: {req.intro_template}")
                processed_video_path = apply_intro(processed_video_path, req.intro_template)
            if req.outro_template:
                add_log(f"Applying outro template: {req.outro_template}")
                processed_video_path = apply_outro(processed_video_path, req.outro_template)
            if req.watermark_path:
                add_log(f"Applying watermark: {req.watermark_path} at {req.watermark_position} with opacity {req.watermark_opacity}")
                processed_video_path = apply_watermark(processed_video_path, req.watermark_path, position=req.watermark_position, opacity=req.watermark_opacity)
            final_video_path = processed_video_path
        except Exception as pe:
            add_log(f"Warning: Failed to apply intro/outro/watermark: {pe}")
            
        video_filename = os.path.basename(final_video_path)
        try:
            meta_path = os.path.splitext(final_video_path)[0] + ".json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(req.dict(), f, indent=4)
        except Exception as me:
            add_log(f"Warning: Failed to save video metadata: {me}")
            
        add_log(f"[GEN_SUCCESS] {video_filename}")
        return {"video_filename": video_filename}
    except Exception as e:
        add_log(f"[GEN_ERROR] Resumed generation failed: {str(e)}")
        add_log(traceback.format_exc())
        raise

@router.post("/api/convert-to-xml")
async def convert_to_xml(req: ConvertXmlRequest):
    clean_text = re.sub(r"\[[^\]]+\]", "", req.text)
    sentences = split_text_into_sentences(clean_text)
    if not sentences:
        return {"xml": ""}
    xml_blocks = [f'<voice name="{req.default_voice}">\n<speak>\n<prosody rate="100%">\n{s}\n</prosody>\n</speak>\n</voice>' for s in sentences]
    return {"xml": "\n\n".join(xml_blocks)}

@router.post("/api/ai-script")
async def generate_ai_script_endpoint(req: AiScriptRequest):
    from backend.llm import generate_ai_script
    config = load_config()
    try:
        script = generate_ai_script(provider=req.provider, model_name=req.model, topic=req.topic, language=req.language, default_voice=req.default_voice, tts_type=req.tts_type, config=config)
        script = re.sub(r"^```[a-zA-Z]*\n", "", script)
        script = re.sub(r"\n```$", "", script)
        return {"script": script.strip()}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {e}")

@router.post("/api/generate")
async def trigger_generation(req: GenerateRequest):
    if not req.video_materials:
        raise HTTPException(status_code=400, detail="You must select at least one video material")
        
    job_id = job_manager.create_job(JobType.GENERATION, req.dict())
    job_manager.start_job(job_id, run_generation_pipeline, req)
    return {"status": "started", "job_id": job_id}

@router.post("/api/jobs/{job_id}/subtitles")
async def submit_edited_subtitles(job_id: str, req: SubtitleReviewRequest):
    """Accept edited subtitles, update the job and resume video assembly."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != JobStatus.AWAITING_REVIEW.value:
        raise HTTPException(status_code=400, detail="Job is not awaiting subtitle review")
        
    # Validate cues structure
    for cue in req.cues:
        if not isinstance(cue.get("start"), (int, float)) or not isinstance(cue.get("end"), (int, float)) or not isinstance(cue.get("text"), str):
            raise HTTPException(status_code=400, detail="Invalid cue format. Must contain start (number), end (number), and text (string)")
            
    # Transition status and launch resume wrapper
    job_manager.update_job_status(job_id, JobStatus.PENDING)
    job_manager.add_job_log(job_id, "Resuming video assembly with reviewed subtitles...")
    job_manager.start_job(job_id, resume_generation_pipeline, req.cues)
    return {"status": "resumed", "job_id": job_id}
