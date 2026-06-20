import os
import sqlite3
import json
import time
import uuid
import threading
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
from backend.config import DOWNLOADS_DIR, CACHE_DIR, load_config
from backend.utils.redact import redact_log_line

JOBS_DB_PATH = os.path.join(DOWNLOADS_DIR, "jobs.db")

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    AWAITING_REVIEW = "awaiting_review"

class JobType(str, Enum):
    GENERATION = "generation"
    DOWNLOAD = "download"
    ASR_MODEL_DOWNLOAD = "asr_model_download"

# Thread-local storage to map the running thread to its job_id
_thread_local = threading.local()

def set_current_job_id(job_id: str | None):
    _thread_local.current_job_id = job_id

def get_current_job_id() -> str | None:
    return getattr(_thread_local, "current_job_id", None)

class JobManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(JobManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.db_lock = threading.Lock()
        
        # Thread pool variables
        self._executor = None
        self._current_max_threads = 0
        
        # Active cancellation events: job_id -> threading.Event
        self._cancellation_events = {}
        self._events_lock = threading.Lock()
        
        # SSE log subscribers: job_id -> list of callback functions
        self._log_subscribers = {}
        self._subscribers_lock = threading.Lock()
        
        self._init_db()
        self._cleanup_old_jobs()
        self._recover_interrupted_jobs()

    def _init_db(self):
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    type TEXT,
                    status TEXT,
                    params TEXT,
                    result TEXT,
                    error TEXT,
                    logs TEXT,
                    progress INTEGER DEFAULT 0,
                    created_at REAL,
                    updated_at REAL
                )
            """)
            conn.commit()
            conn.close()

    def _cleanup_old_jobs(self):
        """Auto-cleanup of jobs older than 30 days."""
        try:
            thirty_days_ago = time.time() - (30 * 24 * 60 * 60)
            with self.db_lock:
                conn = sqlite3.connect(JOBS_DB_PATH)
                cursor = conn.cursor()
                cursor.execute("DELETE FROM jobs WHERE created_at < ?", (thirty_days_ago,))
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Error cleaning up old jobs: {e}")

    def _recover_interrupted_jobs(self):
        """Recover any jobs that were left in 'running' or 'pending' state on startup."""
        try:
            with self.db_lock:
                conn = sqlite3.connect(JOBS_DB_PATH)
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE jobs SET status = ?, error = ?, updated_at = ? WHERE status IN (?, ?)",
                    (JobStatus.FAILED.value, "Job interrupted by server restart", time.time(), JobStatus.RUNNING.value, JobStatus.PENDING.value)
                )
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Error recovering interrupted jobs: {e}")

    def get_executor(self):
        config = load_config()
        max_threads = config.get("max_job_threads", 0)
        if max_threads <= 0:
            max_threads = max(1, os.cpu_count() // 2)
        
        with self._lock:
            if self._executor is None or self._current_max_threads != max_threads:
                if self._executor is not None:
                    self._executor.shutdown(wait=False)
                self._executor = ThreadPoolExecutor(max_workers=max_threads)
                self._current_max_threads = max_threads
            return self._executor

    def create_job(self, job_type: JobType, params: dict) -> str:
        job_id = str(uuid.uuid4())
        now = time.time()
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO jobs (id, type, status, params, result, error, logs, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (job_id, job_type.value, JobStatus.PENDING.value, json.dumps(params), "{}", "", "", 0, now, now)
            )
            conn.commit()
            conn.close()
        return job_id

    def update_job_status(self, job_id: str, status: JobStatus, error: str = "", result: dict = None):
        now = time.time()
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            if result is not None:
                cursor.execute(
                    "UPDATE jobs SET status = ?, error = ?, result = ?, updated_at = ? WHERE id = ?",
                    (status.value, error, json.dumps(result), now, job_id)
                )
            else:
                cursor.execute(
                    "UPDATE jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?",
                    (status.value, error, now, job_id)
                )
            conn.commit()
            conn.close()

    def update_job_progress(self, job_id: str, progress: int):
        now = time.time()
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?",
                (min(100, max(0, progress)), now, job_id)
            )
            conn.commit()
            conn.close()

    def add_job_log(self, job_id: str, message: str):
        redacted_msg = redact_log_line(message)
        now_str = time.strftime("%Y-%m-%d %H:%M:%S")
        formatted_line = f"[{now_str}] {redacted_msg}"
        
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT logs FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            if row:
                current_logs = row[0] or ""
                new_logs = current_logs + formatted_line + "\n"
                cursor.execute("UPDATE jobs SET logs = ? WHERE id = ?", (new_logs, job_id))
                conn.commit()
            conn.close()
            
        self._notify_subscribers(job_id, formatted_line)

    def get_job(self, job_id: str) -> dict | None:
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            conn.close()
            
        if row:
            res = dict(row)
            try:
                res["params"] = json.loads(res["params"])
            except Exception:
                res["params"] = {}
            try:
                res["result"] = json.loads(res["result"])
            except Exception:
                res["result"] = {}
            return res
        return None

    def list_jobs(self, job_type: str = None, status: str = None, limit: int = 50, offset: int = 0) -> list[dict]:
        query = "SELECT id, type, status, progress, created_at, updated_at, error FROM jobs"
        filters = []
        params = []
        
        if job_type:
            filters.append("type = ?")
            params.append(job_type)
        if status:
            filters.append("status = ?")
            params.append(status)
            
        if filters:
            query += " WHERE " + " AND ".join(filters)
            
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()
            
        return [dict(row) for row in rows]

    def delete_job(self, job_id: str):
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
            conn.commit()
            conn.close()

    def wipe_all(self):
        """Wipes all job records from SQLite database."""
        # Cancel all running jobs first
        active_ids = list(self._cancellation_events.keys())
        for jid in active_ids:
            self.cancel_job(jid)
            
        with self.db_lock:
            conn = sqlite3.connect(JOBS_DB_PATH)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM jobs")
            conn.commit()
            conn.close()

    def start_job(self, job_id: str, target_fn, *args, **kwargs):
        """Enqueues a job into the ThreadPoolExecutor."""
        cancel_event = threading.Event()
        with self._events_lock:
            self._cancellation_events[job_id] = cancel_event
            
        self.update_job_status(job_id, JobStatus.RUNNING)
        self.add_job_log(job_id, f"Job started ({job_id})")
        
        executor = self.get_executor()
        executor.submit(self._run_job_wrapper, job_id, cancel_event, target_fn, *args, **kwargs)

    def _run_job_wrapper(self, job_id: str, cancel_event: threading.Event, target_fn, *args, **kwargs):
        set_current_job_id(job_id)
        try:
            # Inject cancel_event as the first argument if the function accepts it,
            # or make it check JobManager().is_cancelled(job_id).
            # We'll run the target function.
            result = target_fn(job_id, cancel_event, *args, **kwargs)
            
            # Check if status was moved to awaiting_review by the target function
            job_in_db = self.get_job(job_id)
            if job_in_db and job_in_db["status"] == JobStatus.AWAITING_REVIEW.value:
                return

            # Check if it was cancelled during execution
            if cancel_event.is_set():
                self.update_job_status(job_id, JobStatus.CANCELLED)
                self.add_job_log(job_id, "Job was cancelled.")
            else:
                self.update_job_status(job_id, JobStatus.COMPLETED, result=result)
                self.update_job_progress(job_id, 100)
                self.add_job_log(job_id, "Job completed successfully.")
        except Exception as e:
            if cancel_event.is_set():
                self.update_job_status(job_id, JobStatus.CANCELLED)
                self.add_job_log(job_id, f"Job was cancelled (ended with error: {e})")
            else:
                import traceback
                error_trace = traceback.format_exc()
                self.update_job_status(job_id, JobStatus.FAILED, error=str(e))
                self.add_job_log(job_id, f"Job failed: {e}")
                self.add_job_log(job_id, error_trace)
        finally:
            set_current_job_id(None)
            with self._events_lock:
                self._cancellation_events.pop(job_id, None)
            
            # Wiping cache if requested
            config = load_config()
            if config.get("wipe_cache_after_generation", False):
                self.clear_cache()

    def cancel_job(self, job_id: str):
        with self._events_lock:
            event = self._cancellation_events.get(job_id)
            if event:
                event.set()
                
        # Also update status in DB
        job = self.get_job(job_id)
        if job and job["status"] in (JobStatus.PENDING.value, JobStatus.RUNNING.value, JobStatus.AWAITING_REVIEW.value):
            self.update_job_status(job_id, JobStatus.CANCELLED)
            self.add_job_log(job_id, "Cancellation requested by user.")

    def is_cancelled(self, job_id: str) -> bool:
        with self._events_lock:
            event = self._cancellation_events.get(job_id)
            if event and event.is_set():
                return True
        # Fallback check database
        job = self.get_job(job_id)
        return job is not None and job["status"] == JobStatus.CANCELLED.value

    # Subscriber management
    def add_log_subscriber(self, job_id: str, callback):
        with self._subscribers_lock:
            if job_id not in self._log_subscribers:
                self._log_subscribers[job_id] = []
            self._log_subscribers[job_id].append(callback)

    def remove_log_subscriber(self, job_id: str, callback):
        with self._subscribers_lock:
            if job_id in self._log_subscribers:
                if callback in self._log_subscribers[job_id]:
                    self._log_subscribers[job_id].remove(callback)
                if not self._log_subscribers[job_id]:
                    del self._log_subscribers[job_id]

    def _notify_subscribers(self, job_id: str, message: str):
        with self._subscribers_lock:
            subscribers = self._log_subscribers.get(job_id, [])
            for callback in list(subscribers):
                try:
                    callback(message)
                except Exception:
                    pass

    # Cache Stats & Operations
    def get_cache_stats(self) -> dict:
        total_size = 0
        num_files = 0
        if os.path.exists(CACHE_DIR):
            for root, _, files in os.walk(CACHE_DIR):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        total_size += os.path.getsize(fp)
                        num_files += 1
                    except OSError:
                        pass
        
        # Human readable size
        size_str = "0 B"
        if total_size > 0:
            import math
            size_name = ("B", "KB", "MB", "GB", "TB")
            i = int(math.floor(math.log(total_size, 1024)))
            p = math.pow(1024, i)
            s = round(total_size / p, 2)
            size_str = f"{s} {size_name[i]}"
            
        return {
            "bytes": total_size,
            "human_readable": size_str,
            "num_files": num_files
        }

    def clear_cache(self):
        """Clears all cached TTS files."""
        if os.path.exists(CACHE_DIR):
            for filename in os.listdir(CACHE_DIR):
                file_path = os.path.join(CACHE_DIR, filename)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                    elif os.path.isdir(file_path):
                        shutil.rmtree(file_path)
                except Exception as e:
                    print(f"Failed to delete {file_path}. Reason: {e}")
