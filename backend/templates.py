import os
import subprocess
from backend.config import DOWNLOADS_DIR

TEMPLATES_DIR = os.path.join(DOWNLOADS_DIR, "templates")
INTROS_DIR = os.path.join(TEMPLATES_DIR, "intros")
OUTROS_DIR = os.path.join(TEMPLATES_DIR, "outros")

os.makedirs(INTROS_DIR, exist_ok=True)
os.makedirs(OUTROS_DIR, exist_ok=True)

def get_intro_templates() -> list[str]:
    if not os.path.exists(INTROS_DIR):
        return []
    return [f for f in os.listdir(INTROS_DIR) if f.endswith((".mp4", ".mov", ".avi", ".mkv"))]

def get_outro_templates() -> list[str]:
    if not os.path.exists(OUTROS_DIR):
        return []
    return [f for f in os.listdir(OUTROS_DIR) if f.endswith((".mp4", ".mov", ".avi", ".mkv"))]

def apply_intro(video_path: str, intro_name: str) -> str:
    intro_path = os.path.join(INTROS_DIR, intro_name)
    if not os.path.exists(intro_path):
        return video_path
        
    out_path = video_path.replace(".mp4", "_intro.mp4")
    # Concat intro and video
    cmd = [
        "ffmpeg", "-y",
        "-i", intro_path,
        "-i", video_path,
        "-filter_complex", "[0:v][0:a][1:v][1:a] concat=n=2:v=1:a=1 [v][a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        out_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error applying intro: {res.stderr}")
        return video_path
    return out_path

def apply_outro(video_path: str, outro_name: str) -> str:
    outro_path = os.path.join(OUTROS_DIR, outro_name)
    if not os.path.exists(outro_path):
        return video_path
        
    out_path = video_path.replace(".mp4", "_outro.mp4")
    # Concat video and outro
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", outro_path,
        "-filter_complex", "[0:v][0:a][1:v][1:a] concat=n=2:v=1:a=1 [v][a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        out_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error applying outro: {res.stderr}")
        return video_path
    return out_path

def apply_watermark(video_path: str, logo_name: str, position: str = "bottom-right", opacity: float = 0.7) -> str:
    logo_path = os.path.join(DOWNLOADS_DIR, "fonts", logo_name)
    if not os.path.exists(logo_path):
        logo_path = os.path.join(DOWNLOADS_DIR, logo_name)
        if not os.path.exists(logo_path):
            return video_path
            
    out_path = video_path.replace(".mp4", "_watermark.mp4")
    
    pos_map = {
        "top-left": "10:10",
        "top-right": "W-w-10:10",
        "bottom-left": "10:H-h-10",
        "bottom-right": "W-w-10:H-h-10"
    }
    overlay_pos = pos_map.get(position, "W-w-10:H-h-10")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", logo_path,
        "-filter_complex", f"[1:v] format=rgba,colorchannelmixer=aa={opacity} [logo]; [0:v][logo] overlay={overlay_pos} [v]",
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        out_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error applying watermark: {res.stderr}")
        return video_path
    return out_path
