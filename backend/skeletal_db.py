import os
import sqlite3
import json
import time
import threading
from backend.config import DOWNLOADS_DIR

SKELETAL_DB_PATH = os.path.join(DOWNLOADS_DIR, "skeletal.db")

class SkeletalDB:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(SkeletalDB, cls).__new__(cls)
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
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                # Table for character rigs
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS skeletal_characters (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        rig_data TEXT,
                        created_at REAL,
                        updated_at REAL
                    )
                """)
                # Table for animations (preset or custom keyframe tracks)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS skeletal_animations (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        character_id TEXT,
                        keyframe_data TEXT,
                        created_at REAL,
                        updated_at REAL
                    )
                """)
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Error initializing Skeletal DB: {e}")

    def save_character(self, char_id: str, name: str, rig_data: dict) -> bool:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                now = time.time()
                rig_str = json.dumps(rig_data)
                
                cursor.execute("SELECT 1 FROM skeletal_characters WHERE id = ?", (char_id,))
                if cursor.fetchone():
                    cursor.execute(
                        "UPDATE skeletal_characters SET name = ?, rig_data = ?, updated_at = ? WHERE id = ?",
                        (name, rig_str, now, char_id)
                    )
                else:
                    cursor.execute(
                        "INSERT INTO skeletal_characters (id, name, rig_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                        (char_id, name, rig_str, now, now)
                    )
                conn.commit()
                conn.close()
                return True
            except Exception as e:
                print(f"Error saving character {char_id}: {e}")
                return False

    def get_character(self, char_id: str) -> dict:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, rig_data FROM skeletal_characters WHERE id = ?", (char_id,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    return {
                        "id": row[0],
                        "name": row[1],
                        "rig_data": json.loads(row[2])
                    }
            except Exception as e:
                print(f"Error fetching character {char_id}: {e}")
        return None

    def list_characters(self) -> list:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, rig_data FROM skeletal_characters")
                rows = cursor.fetchall()
                conn.close()
                return [{
                    "id": r[0],
                    "name": r[1],
                    "rig_data": json.loads(r[2])
                } for r in rows]
            except Exception as e:
                print(f"Error listing characters: {e}")
                return []

    def delete_character(self, char_id: str) -> bool:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM skeletal_characters WHERE id = ?", (char_id,))
                cursor.execute("DELETE FROM skeletal_animations WHERE character_id = ?", (char_id,))
                conn.commit()
                conn.close()
                return True
            except Exception as e:
                print(f"Error deleting character {char_id}: {e}")
                return False

    def save_animation(self, anim_id: str, name: str, character_id: str, keyframe_data: dict) -> bool:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                now = time.time()
                kf_str = json.dumps(keyframe_data)
                
                cursor.execute("SELECT 1 FROM skeletal_animations WHERE id = ?", (anim_id,))
                if cursor.fetchone():
                    cursor.execute(
                        "UPDATE skeletal_animations SET name = ?, character_id = ?, keyframe_data = ?, updated_at = ? WHERE id = ?",
                        (name, character_id, kf_str, now, anim_id)
                    )
                else:
                    cursor.execute(
                        "INSERT INTO skeletal_animations (id, name, character_id, keyframe_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (anim_id, name, character_id, kf_str, now, now)
                    )
                conn.commit()
                conn.close()
                return True
            except Exception as e:
                print(f"Error saving animation {anim_id}: {e}")
                return False

    def get_animation(self, anim_id: str) -> dict:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT id, name, character_id, keyframe_data FROM skeletal_animations WHERE id = ?", (anim_id,))
                row = cursor.fetchone()
                conn.close()
                if row:
                    return {
                        "id": row[0],
                        "name": row[1],
                        "character_id": row[2],
                        "keyframe_data": json.loads(row[3])
                    }
            except Exception as e:
                print(f"Error fetching animation {anim_id}: {e}")
        return None

    def list_animations(self, character_id: str = None) -> list:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                if character_id:
                    cursor.execute("SELECT id, name, character_id, keyframe_data FROM skeletal_animations WHERE character_id = ? OR character_id = 'global'", (character_id,))
                else:
                    cursor.execute("SELECT id, name, character_id, keyframe_data FROM skeletal_animations")
                rows = cursor.fetchall()
                conn.close()
                return [{
                    "id": r[0],
                    "name": r[1],
                    "character_id": r[2],
                    "keyframe_data": json.loads(r[3])
                } for r in rows]
            except Exception as e:
                print(f"Error listing animations: {e}")
                return []

    def delete_animation(self, anim_id: str) -> bool:
        with self.lock:
            try:
                conn = sqlite3.connect(SKELETAL_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM skeletal_animations WHERE id = ?", (anim_id,))
                conn.commit()
                conn.close()
                return True
            except Exception as e:
                print(f"Error deleting animation {anim_id}: {e}")
                return False
