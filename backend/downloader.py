import os
import time
import re
import requests
import yt_dlp
from backend.utils.url_safety import validate_download_url


class YtdlpLogger:
    def __init__(self, log_callback=None):
        self.log_callback = log_callback

    def debug(self, msg):
        if self.log_callback:
            if "[download]" in msg and "%" in msg:
                self.log_callback(msg.strip())
            elif "[Merger]" in msg:
                self.log_callback(f"Merging streams: {msg.strip()}")

    def info(self, msg):
        if self.log_callback:
            self.log_callback(msg.strip())

    def warning(self, msg):
        if self.log_callback:
            self.log_callback(f"Warning: {msg.strip()}")

    def error(self, msg):
        if self.log_callback:
            self.log_callback(f"Error: {msg.strip()}")

def download_video(url: str, output_dir: str, log_callback=None) -> str:
    """
    Downloads video using yt-dlp.
    Merges audio and video stream into an MP4 file.
    """
    validate_download_url(url)
    os.makedirs(output_dir, exist_ok=True)
    
    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s_%(id)s.%(ext)s'),
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'merge_output_format': 'mp4',
        'logger': YtdlpLogger(log_callback),
        'nocheckcertificate': True,
        'quiet': True,
        'no_warnings': True,
    }
    
    if log_callback:
        log_callback(f"Fetching video info for: {url}")
        
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        
        base, _ = os.path.splitext(filename)
        final_mp4 = base + ".mp4"
        
        if os.path.exists(final_mp4):
            if log_callback:
                log_callback(f"Downloaded and saved to: {os.path.basename(final_mp4)}")
            return final_mp4
            
        if log_callback:
            log_callback(f"Downloaded and saved to: {os.path.basename(filename)}")
        return filename

def download_audio(url: str, output_dir: str, log_callback=None) -> str:
    """
    Downloads audio using yt-dlp, extracts and saves it as MP3.
    """
    validate_download_url(url)
    os.makedirs(output_dir, exist_ok=True)
    
    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s_%(id)s.%(ext)s'),
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'logger': YtdlpLogger(log_callback),
        'nocheckcertificate': True,
        'quiet': True,
        'no_warnings': True,
    }
    
    if log_callback:
        log_callback(f"Fetching audio info for: {url}")
        
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        
        base, _ = os.path.splitext(filename)
        final_mp3 = base + ".mp3"
        
        if os.path.exists(final_mp3):
            if log_callback:
                log_callback(f"Downloaded and saved audio to: {os.path.basename(final_mp3)}")
            return final_mp3
            
        if log_callback:
            log_callback(f"Downloaded and saved audio to: {os.path.basename(filename)}")
        return filename


def download_subtitles(url: str, output_dir: str, log_callback=None) -> list[str]:
    """
    Downloads available manual or automatic subtitles using yt-dlp.
    Saves VTT/SRT files without downloading media.
    """
    validate_download_url(url)
    os.makedirs(output_dir, exist_ok=True)
    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s_%(id)s.%(ext)s'),
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitlesformat': 'vtt/srt/best',
        'logger': YtdlpLogger(log_callback),
        'nocheckcertificate': True,
        'quiet': True,
        'no_warnings': True,
    }

    before = set(os.listdir(output_dir)) if os.path.exists(output_dir) else set()
    if log_callback:
        log_callback(f"Fetching subtitles for: {url}")

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info(url, download=True)

    after = set(os.listdir(output_dir))
    new_files = sorted(after - before)
    subtitle_files = [
        os.path.join(output_dir, name)
        for name in new_files
        if name.lower().endswith((".vtt", ".srt", ".ass"))
    ]
    if not subtitle_files:
        raise ValueError("No subtitles were available for this URL")
    if log_callback:
        log_callback(f"Downloaded subtitles: {', '.join(os.path.basename(p) for p in subtitle_files)}")
    return subtitle_files


def download_xhs_via_sidecar(
    url: str,
    material_type: str,
    output_dir: str,
    api_url: str,
    cookie: str = "",
    proxy: str = "",
    log_callback=None,
) -> str | list[str]:
    """
    Uses an optional XHS-Downloader sidecar API to resolve XiaoHongShu media URLs.
    The response shape varies by version, so this parser accepts common URL fields.
    """
    validate_download_url(url)
    validate_download_url(api_url)
    if log_callback:
        log_callback("Trying XiaoHongShu sidecar resolver...")
    payload = {"url": url, "cookie": cookie, "proxy": proxy}
    response = requests.post(api_url, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()

    def collect_urls(obj):
        urls = []
        if isinstance(obj, dict):
            for key, value in obj.items():
                lowered = str(key).lower()
                if isinstance(value, str) and value.startswith(("http://", "https://")):
                    if any(token in lowered for token in ["video", "audio", "music", "url", "subtitle"]):
                        urls.append(value)
                else:
                    urls.extend(collect_urls(value))
        elif isinstance(obj, list):
            for item in obj:
                urls.extend(collect_urls(item))
        return urls

    urls = collect_urls(data)
    if not urls:
        raise ValueError("XHS sidecar did not return downloadable media URLs")

    if material_type in {"music", "audio"}:
        selected = next((item for item in urls if re.search(r"\.(mp3|m4a|aac|wav)(\?|$)", item, re.I)), urls[0])
        return download_audio(selected, output_dir, log_callback)
    if material_type == "subtitle":
        subtitle_url = next((item for item in urls if re.search(r"\.(srt|vtt|ass)(\?|$)", item, re.I)), None)
        if not subtitle_url:
            raise ValueError("XHS sidecar did not return subtitles")
        validate_download_url(subtitle_url)
        os.makedirs(output_dir, exist_ok=True)
        filename = f"xhs_subtitle_{int(time.time())}{os.path.splitext(subtitle_url.split('?')[0])[1] or '.vtt'}"
        path = os.path.join(output_dir, filename)
        content = requests.get(subtitle_url, timeout=60)
        content.raise_for_status()
        with open(path, "wb") as f:
            f.write(content.content)
        return [path]

    selected = next((item for item in urls if re.search(r"\.(mp4|mov|mkv)(\?|$)", item, re.I)), urls[0])
    return download_video(selected, output_dir, log_callback)

def search_and_download_stock(keyword: str, output_dir: str, pexels_keys: list[str] | str, pixabay_keys: list[str] | str, log_callback=None) -> str:
    """
    Searches Pexels and Pixabay for keyword, downloads the best quality video file directly via stream.
    Rotates through multiple API keys if one fails or gets rate-limited.
    """
    video_url = None
    source = ""
    
    # Normalize inputs to lists
    if isinstance(pexels_keys, str):
        pexels_keys = [pexels_keys] if pexels_keys else []
    if isinstance(pixabay_keys, str):
        pixabay_keys = [pixabay_keys] if pixabay_keys else []
        
    pexels_keys = [k.strip() for k in pexels_keys if k.strip()]
    pixabay_keys = [k.strip() for k in pixabay_keys if k.strip()]
    
    # Try Pexels
    for idx, key in enumerate(pexels_keys):
        if log_callback:
            log_callback(f"Searching Pexels for keyword: '{keyword}' (Key {idx+1}/{len(pexels_keys)})...")
        try:
            url = f"https://api.pexels.com/videos/search?query={keyword}&per_page=5"
            headers = {"Authorization": key}
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get("videos"):
                    video = data["videos"][0]
                    files = video.get("video_files", [])
                    # Prefer HD format or first file
                    hd_files = [f for f in files if f.get("quality") == "hd" or f.get("width", 0) >= 1280]
                    selected_file = hd_files[0] if hd_files else (files[0] if files else None)
                    if selected_file:
                        video_url = selected_file["link"]
                        source = "Pexels"
                        break
            elif res.status_code in (401, 403, 429):
                if log_callback:
                    log_callback(f"Warning: Pexels key {idx+1} failed with status code {res.status_code}.")
        except Exception as e:
            if log_callback:
                log_callback(f"Pexels search failed for key {idx+1}: {e}")
                
    # Fallback to Pixabay
    if not video_url and pixabay_keys:
        for idx, key in enumerate(pixabay_keys):
            if log_callback:
                log_callback(f"Searching Pixabay for keyword: '{keyword}' (Key {idx+1}/{len(pixabay_keys)})...")
            try:
                url = f"https://pixabay.com/api/videos/?key={key}&q={keyword}&per_page=5"
                res = requests.get(url, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    if data.get("hits"):
                        hit = data["hits"][0]
                        v_data = hit.get("videos", {})
                        selected = v_data.get("medium") or v_data.get("large") or v_data.get("tiny")
                        if selected:
                            video_url = selected["url"]
                            source = "Pixabay"
                            break
                elif res.status_code in (401, 403, 429):
                    if log_callback:
                        log_callback(f"Warning: Pixabay key {idx+1} failed with status code {res.status_code}.")
            except Exception as e:
                if log_callback:
                    log_callback(f"Pixabay search failed for key {idx+1}: {e}")
                
    if not video_url:
        raise ValueError(f"No stock videos found for keyword '{keyword}' (ensure API keys are valid and not exhausted)")
        
    if log_callback:
        log_callback(f"Found video on {source}! Downloading direct stream...")
        
    safe_keyword = re.sub(r'[^a-zA-Z0-9]', '_', keyword)
    filename = f"stock_{safe_keyword}_{int(time.time())}.mp4"
    filepath = os.path.join(output_dir, filename)
    
    os.makedirs(output_dir, exist_ok=True)
    validate_download_url(video_url)
    res = requests.get(video_url, stream=True, timeout=30)
    res.raise_for_status()
    
    with open(filepath, "wb") as f:
        for chunk in res.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                
    if log_callback:
        log_callback(f"Downloaded stock video: {filename}")
        
    return filepath
