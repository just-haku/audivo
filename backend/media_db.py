import os
import sqlite3
import json
import time
import subprocess
from backend.config import DOWNLOADS_DIR, VIDEOS_DIR, MUSIC_DIR, SUBTITLES_DIR

MEDIA_DB_PATH = os.path.join(DOWNLOADS_DIR, "media.db")

class MediaDB:
    _instance = None
    _lock = threading_lock = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            import threading
            cls._instance = super(MediaDB, cls).__new__(cls)
            cls._instance.lock = threading.Lock()
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._init_db()

    def _init_db(self):
        with self.lock:
            try:
                conn = sqlite3.connect(MEDIA_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS media (
                        filename TEXT PRIMARY KEY,
                        type TEXT,
                        category TEXT,
                        tags TEXT,
                        source_url TEXT,
                        duration REAL,
                        width INTEGER,
                        height INTEGER,
                        has_subtitles INTEGER DEFAULT 0,
                        generated_outputs TEXT,
                        added_at REAL,
                        updated_at REAL
                    )
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        script TEXT,
                        default_voice TEXT,
                        video_materials TEXT,
                        bg_music TEXT,
                        settings TEXT,
                        subtitle_cues TEXT,
                        generated_videos TEXT,
                        created_at REAL,
                        updated_at REAL
                    )
                """)
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Error initializing Media DB: {e}")

    def probe_media(self, filepath: str) -> dict:
        """Probes video or audio file using ffprobe to get duration and resolution."""
        info = {"duration": 0.0, "width": 0, "height": 0}
        if not os.path.exists(filepath):
            return info
            
        try:
            cmd = [
                "ffprobe", "-v", "error", "-show_entries",
                "format=duration:stream=width,height", "-of", "json", filepath
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                
                # Extract duration
                fmt = data.get("format", {})
                if "duration" in fmt:
                    info["duration"] = float(fmt["duration"])
                    
                # Extract resolution (if video)
                streams = data.get("streams", [])
                if streams:
                    stream = streams[0]
                    if "width" in stream and "height" in stream:
                        info["width"] = int(stream["width"])
                        info["height"] = int(stream["height"])
        except Exception as e:
            print(f"Failed to probe media {filepath}: {e}")
            
        return info

    def sync_filesystem(self, directory: str, media_type: str):
        """Scans directory, adds missing files to DB (with probe), and removes deleted files."""
        if not os.path.exists(directory):
            return
            
        try:
            files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f)) and not f.startswith(".")]
            
            with self.lock:
                conn = sqlite3.connect(MEDIA_DB_PATH)
                cursor = conn.cursor()
                
                # 1. Remove files from DB that are no longer on disk
                cursor.execute("SELECT filename FROM media WHERE type = ?", (media_type,))
                db_files = [row[0] for row in cursor.fetchall()]
                
                for db_file in db_files:
                    if db_file not in files:
                        cursor.execute("DELETE FROM media WHERE filename = ?", (db_file,))
                        
                # 2. Add files to DB that are on disk but not in DB
                for f in files:
                    cursor.execute("SELECT 1 FROM media WHERE filename = ?", (f,))
                    if not cursor.fetchone():
                        filepath = os.path.join(directory, f)
                        info = self.probe_media(filepath)
                        now = time.time()
                        cursor.execute(
                            "INSERT INTO media (filename, type, category, tags, source_url, duration, width, height, has_subtitles, generated_outputs, added_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (f, media_type, "", "[]", "", info["duration"], info.get("width", 0), info.get("height", 0), 0, "[]", now, now)
                        )
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Error syncing filesystem in Media DB: {e}")

    def set_metadata(self, filename: str, **kwargs):
        """Updates metadata fields for a file in DB."""
        if not kwargs:
            return
            
        fields = []
        params = []
        for k, v in kwargs.items():
            fields.append(f"{k} = ?")
            if k in ("tags", "generated_outputs") and not isinstance(v, str):
                params.append(json.dumps(v))
            else:
                params.append(v)
                
        params.append(filename)
        query = f"UPDATE media SET {', '.join(fields)}, updated_at = ? WHERE filename = ?"
        params.insert(len(params)-1, time.time())
        
        with self.lock:
            try:
                conn = sqlite3.connect(MEDIA_DB_PATH)
                cursor = conn.cursor()
                cursor.execute(query, params)
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Error setting media metadata for {filename}: {e}")

    def get_metadata(self, filename: str) -> dict | None:
        with self.lock:
            try:
                conn = sqlite3.connect(MEDIA_DB_PATH)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM media WHERE filename = ?", (filename,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    res = dict(row)
                    try:
                        res["tags"] = json.loads(res["tags"])
                    except Exception:
                        res["tags"] = []
                    try:
                        res["generated_outputs"] = json.loads(res["generated_outputs"])
                    except Exception:
                        res["generated_outputs"] = []
                    return res
            except Exception as e:
                print(f"Error getting media metadata for {filename}: {e}")
        return None

    def enrich(self, filenames: list, media_type: str) -> list[dict]:
        """Takes a list of filenames and returns a list of dictionaries with metadata (best effort)."""
        enriched = []
        for f in filenames:
            meta = self.get_metadata(f)
            if meta:
                enriched.append(meta)
            else:
                enriched.append({
                    "filename": f,
                    "type": media_type,
                    "category": "",
                    "tags": [],
                    "source_url": "",
                    "duration": 0.0,
                    "width": 0,
                    "height": 0,
                    "has_subtitles": 0,
                    "generated_outputs": []
                })
        return enriched
