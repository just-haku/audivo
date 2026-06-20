import os
import re
import math
import time
import random
import subprocess
import struct
from backend.tts import split_text_into_sentences, get_optimal_workers
from typing import Any

def get_font_name(font_path: str) -> str:
    """Parses a TTF or OTF file to extract its Font Family name."""
    try:
        with open(font_path, 'rb') as f:
            scaler_type = f.read(4)
            num_tables = struct.unpack('>H', f.read(2))[0]
            search_range = struct.unpack('>H', f.read(2))[0]
            entry_selector = struct.unpack('>H', f.read(2))[0]
            range_shift = struct.unpack('>H', f.read(2))[0]
            
            name_offset = None
            name_length = None
            for _ in range(num_tables):
                tag = f.read(4).decode('latin-1')
                checksum = struct.unpack('>I', f.read(4))[0]
                offset = struct.unpack('>I', f.read(4))[0]
                length = struct.unpack('>I', f.read(4))[0]
                if tag == 'name':
                    name_offset = offset
                    name_length = length
                    break
            
            if name_offset is None:
                return os.path.splitext(os.path.basename(font_path))[0]
                
            f.seek(name_offset)
            format_selector = struct.unpack('>H', f.read(2))[0]
            count = struct.unpack('>H', f.read(2))[0]
            string_offset = struct.unpack('>H', f.read(2))[0]
            
            name_records = []
            for _ in range(count):
                platform_id = struct.unpack('>H', f.read(2))[0]
                encoding_id = struct.unpack('>H', f.read(2))[0]
                language_id = struct.unpack('>H', f.read(2))[0]
                name_id = struct.unpack('>H', f.read(2))[0]
                length = struct.unpack('>H', f.read(2))[0]
                offset = struct.unpack('>H', f.read(2))[0]
                name_records.append((platform_id, encoding_id, language_id, name_id, length, offset))
                
            font_family = None
            for r in name_records:
                platform_id, encoding_id, language_id, name_id, length, offset = r
                if name_id == 1:
                    f.seek(name_offset + string_offset + offset)
                    data = f.read(length)
                    if platform_id in (0, 3):
                        try:
                            val = data.decode('utf-16-be')
                        except UnicodeDecodeError:
                            val = data.decode('latin-1')
                    else:
                        val = data.decode('latin-1')
                    if platform_id == 3 and language_id == 1033:
                        return val.strip()
                    font_family = val.strip()
            
            if font_family:
                return font_family
            return os.path.splitext(os.path.basename(font_path))[0]
    except Exception as e:
        print(f"Error parsing font {font_path}: {e}")
        return os.path.splitext(os.path.basename(font_path))[0]


def hex_to_ass_color(hex_str: str) -> str:
    """Converts a standard hex color string (e.g. '#FFCC00' or 'FFCC00') to ASS color format (&H00BBGGRR)."""
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r, g, b = hex_str[0:2], hex_str[2:4], hex_str[4:6]
        return f"&H00{b}{g}{r}"
    elif len(hex_str) == 8:
        a, r, g, b = hex_str[0:2], hex_str[2:4], hex_str[4:6], hex_str[6:8]
        return f"&H{a}{b}{g}{r}"
    return "&H00FFFFFF"

def format_ass_time(seconds: float) -> str:
    """Formats seconds into ASS timestamp format H:MM:SS.CS."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds % 1) * 100))
    if cs == 100:
        cs = 0
        s += 1
        if s == 60:
            s = 0
            m += 1
            if m == 60:
                m = 0
                h += 1
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def _ass_header(style: dict) -> str:
    font_name = style.get("font_name", "Arial")
    font_size = style.get("font_size", 48)
    primary_color = hex_to_ass_color(style.get("primary_color", "#FFFFFF"))
    outline_color = hex_to_ass_color(style.get("outline_color", "#000000"))
    outline_width = style.get("outline_width", 3)
    back_color = hex_to_ass_color(style.get("back_color", "#000000"))
    shadow_depth = style.get("shadow_depth", 0)
    bold = 1 if style.get("bold") else 0
    italic = 1 if style.get("italic") else 0
    alignment = style.get("alignment", 2)
    margin_v = style.get("margin_v", 180 if style.get("aspect_ratio") == "9:16" else 60)

    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {style.get("width", 1080)}
PlayResY: {style.get("height", 1920)}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{outline_color},{back_color},{bold},{italic},0,0,100,100,0,0,1,{outline_width},{shadow_depth},{alignment},10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _clean_subtitle_text(text: str) -> str:
    text = re.sub(r"\[[^\]]+\]", "", text.replace("\n", " "))
    return " ".join(text.split())


def _format_subtitle_lines(text: str, max_words_per_line: int = 8) -> str:
    words = text.split()
    if len(words) > max_words_per_line:
        mid = len(words) // 2
        return " ".join(words[:mid]) + "\\N" + " ".join(words[mid:])
    return text


def write_ass_cues(cues: list[dict], output_path: str, style: dict):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(_ass_header(style))
        for cue in cues:
            text = _clean_subtitle_text(cue.get("text", ""))
            if not text:
                text = " "
            start = max(float(cue.get("start", 0.0)), 0.0)
            end = max(float(cue.get("end", start)), start + 0.05)
            f.write(
                f"Dialogue: 0,{format_ass_time(start)},{format_ass_time(end)},Default,,0,0,0,,{_format_subtitle_lines(text)}\n"
            )


def build_estimated_subtitle_cues(segments: list[dict]) -> list[dict]:
    cues = []
    current_time = 0.0
    for seg in segments:
        duration = float(seg["duration"])
        clean_text = _clean_subtitle_text(seg["text"])
        sentences = [s.strip() for s in split_text_into_sentences(clean_text) if s.strip()]
        if not sentences:
            cues.append({"start": current_time, "end": current_time + duration, "text": " "})
            current_time += duration
            continue

        total_chars = sum(len(s) for s in sentences) or 1
        for sentence in sentences:
            sent_duration = (len(sentence) / total_chars) * duration
            cues.append({"start": current_time, "end": current_time + sent_duration, "text": sentence})
            current_time += sent_duration
    return cues


def build_asr_subtitle_cues(asr_segments: list[dict], style: dict) -> list[dict]:
    max_chars = int(style.get("max_chars", 42) or 42)
    max_duration = float(style.get("max_duration", 4.0) or 4.0)
    min_duration = float(style.get("min_duration", 0.8) or 0.8)
    conjunctions = {
        "and", "but", "or", "so", "because", "although", "while", "however",
        "và", "nhưng", "hoặc", "nên", "vì", "bởi", "khi", "nếu", "rồi",
    }
    terminal_re = re.compile(r"[.!?。！？,;:，；：]$")

    cues = []
    for segment in asr_segments:
        words = segment.get("words") or []
        if not words:
            text = _clean_subtitle_text(segment.get("text", ""))
            if text:
                start = float(segment.get("start", 0.0))
                end = float(segment.get("end", start + min_duration))
                chunks = split_text_into_sentences(text) or [text]
                chunk_duration = max((end - start) / max(len(chunks), 1), min_duration)
                for chunk in chunks:
                    cues.append({"start": start, "end": min(start + chunk_duration, end), "text": chunk})
                    start += chunk_duration
            continue

        current_words = []
        cue_start = None
        cue_end = None
        for word in words:
            token = _clean_subtitle_text(str(word.get("word", "")))
            if not token:
                continue
            word_start = float(word.get("start", segment.get("start", 0.0)))
            word_end = float(word.get("end", word_start + 0.2))
            if cue_start is None:
                cue_start = word_start
            current_words.append(token)
            cue_end = word_end
            text = " ".join(current_words)
            duration = cue_end - cue_start
            should_split = (
                (duration >= min_duration and terminal_re.search(token))
                or (duration >= min_duration and token.lower().strip(",.;:!?") in conjunctions and len(text) >= max_chars * 0.45)
                or len(text) >= max_chars
                or duration >= max_duration
            )
            if should_split:
                cues.append({"start": cue_start, "end": cue_end, "text": text})
                current_words = []
                cue_start = None
                cue_end = None

        if current_words and cue_start is not None and cue_end is not None:
            cues.append({"start": cue_start, "end": max(cue_end, cue_start + min_duration), "text": " ".join(current_words)})

    return cues


def generate_ass_file(segments: list[dict], output_path: str, style: dict):
    """
    Generates an ASS subtitle file from list of TTS segments using estimated timing.
    Prefer ``generate_ass_from_asr`` when ASR timestamps are available.
    """
    write_ass_cues(build_estimated_subtitle_cues(segments), output_path, style)


def generate_ass_from_asr(asr_segments: list[dict], output_path: str, style: dict):
    """Generates ASS subtitles from ASR word/segment timestamps."""
    cues = build_asr_subtitle_cues(asr_segments, style)
    if not cues:
        raise ValueError("ASR did not return usable subtitle timestamps")
    write_ass_cues(cues, output_path, style)


def generate_ass_file_legacy(segments: list[dict], output_path: str, style: dict):
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(_ass_header(style))
        current_time = 0.0
        for seg in segments:
            duration = seg["duration"]
            
            # Strip VieNeu emotion tags (e.g. [cười])
            raw_text = seg["text"].replace("\n", " ")
            clean_text = re.sub(r"\[[^\]]+\]", "", raw_text)
            clean_text = " ".join(clean_text.split())
            
            # Split the paragraph text into sentences using the new smart divider
            sentences = split_text_into_sentences(clean_text)
            
            # If no sentences found (e.g. empty paragraph), default to single empty line
            if not sentences:
                start_str = format_ass_time(current_time)
                end_str = format_ass_time(current_time + duration)
                f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,, \n")
                current_time += duration
                continue
            
            # Calculate total characters for weights
            # Filter out empty or whitespace-only sentences
            valid_sentences = [s.strip() for s in sentences if s.strip()]
            if not valid_sentences:
                start_str = format_ass_time(current_time)
                end_str = format_ass_time(current_time + duration)
                f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,, \n")
                current_time += duration
                continue
                
            total_chars = sum(len(s) for s in valid_sentences)
            
            for s in valid_sentences:
                # Allocate duration proportionally based on character weight
                if total_chars > 0:
                    weight = len(s) / total_chars
                    sent_duration = weight * duration
                else:
                    sent_duration = duration / len(valid_sentences)
                    
                start_str = format_ass_time(current_time)
                end_str = format_ass_time(current_time + sent_duration)
                
                # Format long sentence to max 2 lines
                words = s.split()
                if len(words) > 8:
                    mid = len(words) // 2
                    line_text = " ".join(words[:mid]) + "\\N" + " ".join(words[mid:])
                else:
                    line_text = s
                    
                f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{line_text}\n")
                current_time += sent_duration

def get_media_duration(file_path: str) -> float:
    """Get duration of a media file using ffprobe."""
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", file_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception:
        if file_path.endswith(".mp3"):
            try:
                from mutagen.mp3 import MP3

                audio = MP3(file_path)
                return audio.info.length
            except Exception:
                pass
        return 0.0

def process_video_segment(
    clip_path: str,
    offset: float,
    duration: float,
    speed: float,
    width: int,
    height: int,
    output_path: str,
    mute_video: bool = True,
    log_callback=None
):
    """
    Trims, scales, crops, speeds up and saves a video clip segment.
    Uses infinite loop demuxing so that short clips can cover long segments.
    """
    if log_callback:
        log_callback(f"Processing segment: clip={os.path.basename(clip_path)} offset={offset}s dur={duration}s speed={speed}x mute={mute_video}")

    # FFmpeg command builder:
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1",
        "-ss", str(offset),
        "-i", clip_path,
    ]
    
    # Video Filters: Scale, center crop, speed PTS, force 30fps and 1:1 SAR
    vf_chain = f"scale=w={width}:h={height}:force_original_aspect_ratio=increase,crop={width}:{height},fps=30,setsar=1,setpts=PTS/{speed}"
    cmd.extend(["-vf", vf_chain, "-t", str(duration)])
    
    if mute_video:
        cmd.append("-an")
    else:
        # Adjust audio tempo speed to keep in sync with video speed
        cmd.extend(["-filter:a", f"atempo={speed}"])
        
    cmd.extend([
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-preset", "ultrafast",
        "-threads", "1",
        output_path
    ])
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

def has_audio_stream(file_path: str) -> bool:
    """Check if a video/audio file contains an audio stream using ffprobe."""
    cmd = [
        "ffprobe", "-v", "error", "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1", file_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return "audio" in result.stdout
    except Exception:
        return False


def parse_ass_time(t_str: str) -> float:
    """Converts ASS timestamp H:MM:SS.CS to seconds."""
    parts = t_str.split(":")
    h = int(parts[0])
    m = int(parts[1])
    s_parts = parts[2].split(".")
    s = int(s_parts[0])
    cs = int(s_parts[1])
    return h * 3600 + m * 60 + s + cs / 100.0


def shift_and_write_ass(input_path: str, output_path: str, start_time: float, end_time: float):
    """Slices and shifts subtitles in an ASS file to fit a chunk window."""
    with open(input_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    events_started = False
    dialogue_format = None
    
    with open(output_path, "w", encoding="utf-8") as out:
        for line in lines:
            if line.startswith("[Events]"):
                events_started = True
                out.write(line)
                continue
            if not events_started:
                out.write(line)
                continue
            
            if line.startswith("Format:"):
                out.write(line)
                parts = [p.strip() for p in line.split(":", 1)[1].split(",")]
                dialogue_format = parts
                continue
                
            if line.startswith("Dialogue:"):
                try:
                    content = line.split(":", 1)[1]
                    parts = content.split(",", len(dialogue_format) - 1)
                    
                    start_idx = dialogue_format.index("Start")
                    end_idx = dialogue_format.index("End")
                    
                    start_t = parse_ass_time(parts[start_idx].strip())
                    end_t = parse_ass_time(parts[end_idx].strip())
                    
                    if start_t < end_time and end_t > start_time:
                        shifted_start = max(start_t - start_time, 0.0)
                        shifted_end = min(end_t - start_time, end_time - start_time)
                        if shifted_end > shifted_start + 0.01:
                            parts[start_idx] = format_ass_time(shifted_start)
                            parts[end_idx] = format_ass_time(shifted_end)
                            out.write("Dialogue:" + ",".join(parts))
                except Exception:
                    out.write(line)
            else:
                out.write(line)


def get_looped_audio_slice(audio, start_ms: int, end_ms: int):
    """Extracts a slice from an AudioSegment by looping it if necessary.
    This avoids creating a giant in-memory looped AudioSegment for very long videos.
    """
    from pydub import AudioSegment
    duration_needed = end_ms - start_ms
    if duration_needed <= 0:
        return AudioSegment.empty()
    audio_len = len(audio)
    if audio_len == 0:
        return AudioSegment.empty()
    
    pos = start_ms % audio_len
    out = AudioSegment.empty()
    while len(out) < duration_needed:
        chunk_len = min(audio_len - pos, duration_needed - len(out))
        out += audio[pos : pos + chunk_len]
        pos = 0  # subsequent iterations start from beginning of audio
    return out


def get_sliced_bg_music(bg_music_info: list[dict], total_duration: float, start_ms: int, end_ms: int) -> Any:
    """Dynamically loads and slices BGM files for a specific time range to save RAM."""
    from pydub import AudioSegment
    duration_needed_ms = end_ms - start_ms
    if duration_needed_ms <= 0 or not bg_music_info or total_duration <= 0:
        return AudioSegment.empty()
        
    total_duration_ms = int(total_duration * 1000)
    current_pos_ms = start_ms % total_duration_ms
    
    sliced_audio = AudioSegment.empty()
    
    while len(sliced_audio) < duration_needed_ms:
        # Find which BGM file corresponds to current_pos_ms
        accumulated_ms = 0
        target_file = None
        offset_in_file_ms = 0
        
        for bgm in bg_music_info:
            bgm_dur_ms = int(bgm["duration"] * 1000)
            if accumulated_ms + bgm_dur_ms > current_pos_ms:
                target_file = bgm["path"]
                offset_in_file_ms = current_pos_ms - accumulated_ms
                break
            accumulated_ms += bgm_dur_ms
            
        if not target_file:
            # Fallback if precision error occurs
            target_file = bg_music_info[-1]["path"]
            offset_in_file_ms = current_pos_ms - (accumulated_ms - int(bg_music_info[-1]["duration"] * 1000))
            
        # Determine how much duration we can read from this file
        target_dur_ms = int(get_media_duration(target_file) * 1000)
        remaining_in_file_ms = target_dur_ms - offset_in_file_ms
        chunk_len_ms = min(remaining_in_file_ms, duration_needed_ms - len(sliced_audio))
        
        if chunk_len_ms > 0:
            try:
                full_file_audio = AudioSegment.from_file(target_file)
                sliced_audio += full_file_audio[offset_in_file_ms : offset_in_file_ms + chunk_len_ms]
            except Exception:
                sliced_audio += AudioSegment.silent(duration=chunk_len_ms)
                
        # Advance current position
        current_pos_ms = (current_pos_ms + chunk_len_ms) % total_duration_ms
        
    return sliced_audio


def render_video_chunk(
    chunk_idx: int,
    chunk_segments: list[dict],
    video_segments_info: list[dict],
    combined_bg_music,
    bg_music_volume: float,
    video_speed: float,
    subtitles_path: str,
    T_start: float,
    T_end: float,
    output_path: str,
    width: int,
    height: int,
    mute_video: bool,
    log_callback=None
):
    groups = []
    current_group = None
    for idx, seg in enumerate(chunk_segments):
        info = video_segments_info[idx]
        clip_path = info["clip_path"]
        offset = info["offset"]
        duration = seg["duration"]
        source_dur = duration * video_speed
        
        if current_group is None:
            current_group = {
                "clip_path": clip_path,
                "start_offset": offset,
                "segments_indices": [idx],
                "total_duration": duration,
                "total_source_duration": source_dur
            }
        else:
            prev_end_offset = current_group["start_offset"] + current_group["total_source_duration"]
            is_same_clip = (clip_path == current_group["clip_path"])
            is_contiguous = abs(offset - prev_end_offset) < 0.05
            
            if is_same_clip and is_contiguous:
                current_group["segments_indices"].append(idx)
                current_group["total_duration"] += duration
                current_group["total_source_duration"] += source_dur
            else:
                groups.append(current_group)
                current_group = {
                    "clip_path": clip_path,
                    "start_offset": offset,
                    "segments_indices": [idx],
                    "total_duration": duration,
                    "total_source_duration": source_dur
                }
    if current_group is not None:
        groups.append(current_group)

    tmp_dir = os.path.dirname(output_path)
    temp_files = []
    
    try:
        group_videos = [os.path.join(tmp_dir, f"temp_chunk_{chunk_idx}_g_{g_idx}.mp4") for g_idx in range(len(groups))]
        for g_vid in group_videos:
            temp_files.append(g_vid)
            
        def process_worker(g_idx):
            group = groups[g_idx]
            process_video_segment(
                clip_path=group["clip_path"],
                offset=group["start_offset"],
                duration=group["total_duration"],
                speed=video_speed,
                width=width,
                height=height,
                output_path=group_videos[g_idx],
                mute_video=mute_video,
                log_callback=log_callback
            )
            
        cores = os.cpu_count() or 4
        max_workers = min(cores, 6)
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            list(executor.map(process_worker, range(len(groups))))
            
        concat_txt_path = os.path.join(tmp_dir, f"concat_chunk_{chunk_idx}.txt")
        temp_files.append(concat_txt_path)
        with open(concat_txt_path, "w", encoding="utf-8") as f:
            for g_vid in group_videos:
                f.write(f"file '{os.path.abspath(g_vid)}'\n")
                
        merged_video_path = os.path.join(tmp_dir, f"temp_chunk_{chunk_idx}_merged.mp4")
        temp_files.append(merged_video_path)
        
        cmd_concat = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_txt_path,
            "-c:v", "copy",
        ]
        if not mute_video:
            cmd_concat.extend(["-c:a", "aac"])
        cmd_concat.append(merged_video_path)
        subprocess.run(cmd_concat, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        
        voiceover_path = os.path.join(tmp_dir, f"temp_chunk_{chunk_idx}_voiceover.mp3")
        temp_files.append(voiceover_path)
        
        from pydub import AudioSegment
        chunk_voiceover = AudioSegment.empty()
        for seg in chunk_segments:
            audio_p = seg.get("audio_path")
            if audio_p and os.path.exists(audio_p):
                chunk_voiceover += AudioSegment.from_file(audio_p)
                
        if len(chunk_voiceover) == 0:
            raise ValueError(f"No audio files found for chunk {chunk_idx}")
            
        chunk_voiceover.export(voiceover_path, format="mp3", bitrate="192k")
        mixed_audio_path = voiceover_path
        
        if combined_bg_music:
            voice_dur_ms = len(chunk_voiceover)
            start_ms = int(T_start * 1000)
            end_ms = start_ms + voice_dur_ms
            if isinstance(combined_bg_music, dict) and "info" in combined_bg_music:
                chunk_bg = get_sliced_bg_music(
                    bg_music_info=combined_bg_music["info"],
                    total_duration=combined_bg_music["total_duration"],
                    start_ms=start_ms,
                    end_ms=end_ms
                )
            else:
                chunk_bg = get_looped_audio_slice(combined_bg_music, start_ms, end_ms)
            
            if chunk_bg and len(chunk_bg) > 0:
                try:
                    from pydub.effects import normalize
                    if chunk_voiceover.max > 0:
                        chunk_voiceover = normalize(chunk_voiceover)
                    if chunk_bg.max > 0:
                        chunk_bg = normalize(chunk_bg)
                except Exception:
                    pass
                    
                vol_factor = max(bg_music_volume, 0.001)
                vol_db = 40 * math.log10(vol_factor)
                chunk_bg = chunk_bg + vol_db
                
                mixed_audio = chunk_bg.overlay(chunk_voiceover)
                mixed_audio_path = os.path.join(tmp_dir, f"temp_chunk_{chunk_idx}_mixed.mp3")
                temp_files.append(mixed_audio_path)
                mixed_audio.export(mixed_audio_path, format="mp3", bitrate="192k")
            
        chunk_sub_path = os.path.join(tmp_dir, f"temp_chunk_{chunk_idx}_subs.ass")
        temp_files.append(chunk_sub_path)
        
        shift_and_write_ass(subtitles_path, chunk_sub_path, T_start, T_end)
        
        cmd_final = [
            "ffmpeg", "-y",
            "-i", merged_video_path,
            "-i", mixed_audio_path,
        ]
        cmd_final.extend([
            "-map", "0:v",
            "-map", "1:a"
        ])
        
        rel_sub_name = os.path.basename(chunk_sub_path)
        vf_val = f"subtitles={rel_sub_name}"
        fonts_dir = os.path.join(os.path.dirname(tmp_dir), "fonts")
        if os.path.exists(fonts_dir):
            escaped_fonts_dir = os.path.abspath(fonts_dir).replace(":", "\\:")
            vf_val += f":fontsdir='{escaped_fonts_dir}'"
            
        total_duration = T_end - T_start
        cmd_final.extend([
            "-vf", vf_val,
            "-c:v", "libx264",
            "-crf", "20",
            "-preset", "fast",
            "-threads", str(max_workers),
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", f"{total_duration:.3f}",
            output_path
        ])
        
        subprocess.run(cmd_final, cwd=tmp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        
    finally:
        for temp_f in temp_files:
            if os.path.exists(temp_f):
                try:
                    os.remove(temp_f)
                except Exception:
                    pass
        import gc
        gc.collect()


def compose_final_video(
    segments: list[dict],
    video_materials: list[str],
    bg_music_paths: list[str] | str | None,
    bg_music_volume: float,
    video_speed: float,
    subtitles_path: str,
    output_dir: str,
    style: dict,
    mute_video: bool = True,
    video_order_mode: str = "ordered",
    log_callback=None
) -> str:
    """
    Main video composition pipeline. Uses chunked video rendering for stability.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    width = style.get("width", 1080)
    height = style.get("height", 1920)
    
    if not video_materials:
        raise ValueError("No video materials selected")
        
    valid_video_materials = [path for path in video_materials if get_media_duration(path) > 0]
    if not valid_video_materials:
        raise ValueError("All selected video materials have invalid or zero duration.")

    from pydub import AudioSegment
    
    video_segments_info = []
    current_video_idx = 0
    current_offset = 0.0
    
    for i, seg in enumerate(segments):
        req_dur_source = seg["duration"] * video_speed
        if video_order_mode == "random":
            selected_clip = random.choice(valid_video_materials)
            clip_dur = get_media_duration(selected_clip)
            max_offset = max(clip_dur - req_dur_source, 0.0)
            offset = round(random.uniform(0.0, max_offset), 2) if max_offset > 0 else 0.0
            video_segments_info.append({
                "clip_path": selected_clip,
                "offset": offset
            })
            continue

        clip_path = video_materials[current_video_idx]
        clip_dur = get_media_duration(clip_path)
        
        attempts = 0
        while clip_dur <= 0 and attempts < len(video_materials):
            current_video_idx = (current_video_idx + 1) % len(video_materials)
            clip_path = video_materials[current_video_idx]
            clip_dur = get_media_duration(clip_path)
            attempts += 1
            current_offset = 0.0
            
        if clip_dur <= 0:
            raise ValueError("All selected video materials have invalid or zero duration.")
            
        if req_dur_source > clip_dur:
            offset = 0.0
            selected_clip = clip_path
            current_video_idx = (current_video_idx + 1) % len(video_materials)
            current_offset = 0.0
        elif current_offset + req_dur_source > clip_dur:
            current_video_idx = (current_video_idx + 1) % len(video_materials)
            current_offset = 0.0
            clip_path = video_materials[current_video_idx]
            clip_dur = get_media_duration(clip_path)
            
            if req_dur_source > clip_dur:
                offset = 0.0
                selected_clip = clip_path
                current_video_idx = (current_video_idx + 1) % len(video_materials)
                current_offset = 0.0
            else:
                offset = 0.0
                selected_clip = clip_path
                current_offset = req_dur_source
        else:
            offset = current_offset
            selected_clip = clip_path
            current_offset += req_dur_source
            
        video_segments_info.append({
            "clip_path": selected_clip,
            "offset": round(offset, 2)
        })

    segment_times = []
    current_time = 0.0
    for seg in segments:
        dur = seg["duration"]
        segment_times.append({
            "start": current_time,
            "end": current_time + dur,
            "duration": dur
        })
        current_time += dur
        
    if isinstance(bg_music_paths, str):
        bg_music_paths = [bg_music_paths]
    elif not bg_music_paths:
        bg_music_paths = []
        
    bg_music_info = []
    total_bgm_duration = 0.0
    for path in bg_music_paths:
        if path and os.path.exists(path):
            dur = get_media_duration(path)
            if dur > 0:
                bg_music_info.append({"path": path, "duration": dur})
                total_bgm_duration += dur
            elif log_callback:
                log_callback(f"Warning: Background music {path} has invalid duration")
                
    bg_music_payload = None
    if bg_music_info:
        bg_music_payload = {"info": bg_music_info, "total_duration": total_bgm_duration}
                     
    chunk_size = 50
    chunk_files = []
    num_segments = len(segments)
    
    try:
        for chunk_idx, i_start in enumerate(range(0, num_segments, chunk_size)):
            i_end = min(i_start + chunk_size, num_segments)
            
            chunk_segs = segments[i_start:i_end]
            chunk_info = video_segments_info[i_start:i_end]
            
            T_start = segment_times[i_start]["start"]
            T_end = segment_times[i_end - 1]["end"]
            
            chunk_out_path = os.path.join(output_dir, f"temp_chunk_{chunk_idx}.mp4")
            chunk_files.append(chunk_out_path)
            
            if log_callback:
                log_callback(f"Rendering video chunk {chunk_idx + 1} / {math.ceil(num_segments / chunk_size)} (segments {i_start} to {i_end - 1})...")
                
            render_video_chunk(
                chunk_idx=chunk_idx,
                chunk_segments=chunk_segs,
                video_segments_info=chunk_info,
                combined_bg_music=bg_music_payload,
                bg_music_volume=bg_music_volume,
                video_speed=video_speed,
                subtitles_path=subtitles_path,
                T_start=T_start,
                T_end=T_end,
                output_path=chunk_out_path,
                width=width,
                height=height,
                mute_video=mute_video,
                log_callback=log_callback
            )
            import gc
            gc.collect()
            
        if log_callback:
            log_callback("Step 4/4: Concatenating all video chunks...")
            
        final_video_name = f"generated_video_{int(time.time())}.mp4"
        final_video_path = os.path.join(output_dir, final_video_name)
        
        concat_txt_path = os.path.join(output_dir, "chunks_concat_list.txt")
        with open(concat_txt_path, "w", encoding="utf-8") as f:
            for chunk_f in chunk_files:
                f.write(f"file '{os.path.abspath(chunk_f)}'\n")
                
        cmd_concat = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_txt_path,
            "-c", "copy",
            final_video_name
        ]
        
        subprocess.run(cmd_concat, cwd=output_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        
        if os.path.exists(concat_txt_path):
            try: os.remove(concat_txt_path)
            except Exception: pass
            
        if log_callback:
            log_callback(f"Success! Video created: {final_video_name}")
            
        return final_video_path
        
    finally:
        if log_callback:
            log_callback("Cleaning up temporary chunk video files...")
        for chunk_f in chunk_files:
            if os.path.exists(chunk_f):
                try:
                    os.remove(chunk_f)
                except Exception:
                    pass
