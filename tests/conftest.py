import pytest
import os
import shutil
import tempfile
from fastapi.testclient import TestClient

@pytest.fixture(scope="session", autouse=True)
def test_env():
    # Create temp directory
    temp_dir = tempfile.mkdtemp()
    
    # Override paths in backend.config
    import backend.config
    backend.config.BASE_DIR = temp_dir
    backend.config.CONFIG_PATH = os.path.join(temp_dir, "config.json")
    backend.config.DOWNLOADS_DIR = os.path.join(temp_dir, "downloads")
    backend.config.VIDEOS_DIR = os.path.join(backend.config.DOWNLOADS_DIR, "videos")
    backend.config.MUSIC_DIR = os.path.join(backend.config.DOWNLOADS_DIR, "music")
    backend.config.GENERATED_DIR = os.path.join(backend.config.DOWNLOADS_DIR, "generated")
    backend.config.FONTS_DIR = os.path.join(backend.config.DOWNLOADS_DIR, "fonts")
    backend.config.SUBTITLES_DIR = os.path.join(backend.config.DOWNLOADS_DIR, "subtitles")
    backend.config.MODELS_DIR = os.path.join(backend.config.DOWNLOADS_DIR, "models")
    backend.config.CACHE_DIR = os.path.join(temp_dir, "cache")
    backend.config.CREDS_PATH = os.path.join(temp_dir, "creds.json")
    
    # Ensure folders exist
    os.makedirs(backend.config.DOWNLOADS_DIR, exist_ok=True)
    os.makedirs(backend.config.VIDEOS_DIR, exist_ok=True)
    os.makedirs(backend.config.MUSIC_DIR, exist_ok=True)
    os.makedirs(backend.config.GENERATED_DIR, exist_ok=True)
    os.makedirs(backend.config.FONTS_DIR, exist_ok=True)
    os.makedirs(backend.config.SUBTITLES_DIR, exist_ok=True)
    os.makedirs(backend.config.MODELS_DIR, exist_ok=True)
    os.makedirs(backend.config.CACHE_DIR, exist_ok=True)
    os.makedirs(os.path.join(temp_dir, "frontend"), exist_ok=True)
    
    # Override paths in backend.jobs
    import backend.jobs
    backend.jobs.JOBS_DB_PATH = os.path.join(backend.config.DOWNLOADS_DIR, "jobs.db")
    
    # Override paths in backend.media_db
    import backend.media_db
    backend.media_db.MEDIA_DB_PATH = os.path.join(backend.config.DOWNLOADS_DIR, "media.db")
    
    # Write default config
    backend.config.save_config(backend.config.DEFAULT_CONFIG)
    
    # Initialize databases
    # JobManager singleton initialization
    from backend.jobs import JobManager
    # Reset/close existing if any
    if JobManager._instance:
        if hasattr(JobManager._instance, "_executor") and JobManager._instance._executor:
            JobManager._instance._executor.shutdown(wait=False)
        JobManager._instance = None
    JobManager() # re-init with mocked JOBS_DB_PATH
    
    from backend.media_db import MediaDB
    if MediaDB._instance:
        MediaDB._instance = None
    MediaDB() # re-init with mocked MEDIA_DB_PATH
    
    yield temp_dir
    
    # Shutdown JobManager executor if initialized
    if JobManager._instance:
        if hasattr(JobManager._instance, "_executor") and JobManager._instance._executor:
            JobManager._instance._executor.shutdown(wait=False)
        JobManager._instance = None
        
    # Cleanup temp dir
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def client():
    # Make sure to import app after config overrides are in place
    from backend.app import app
    with TestClient(app) as c:
        yield c
