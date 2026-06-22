import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.config import GENERATED_DIR, FONTS_DIR, BASE_DIR
from backend.routers import asr, config, materials, voices, gallery, system, generation, jobs, health, presets, projects, wizard, skeletal
from backend.jobs import JobManager
from backend.media_db import MediaDB

# Initialize JobManager and MediaDB on startup to recover jobs and setup database tables
JobManager()
MediaDB()

app = FastAPI(title="MoneyPrinterTurbo Clone API")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static folders
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")
app.mount("/fonts", StaticFiles(directory=FONTS_DIR), name="fonts")
app.mount("/frontend", StaticFiles(directory=os.path.join(BASE_DIR, "frontend")), name="frontend")

# Include Routers
app.include_router(config.router)
app.include_router(materials.router)
app.include_router(voices.router)
app.include_router(gallery.router)
app.include_router(system.router)
app.include_router(generation.router)
app.include_router(asr.router)
app.include_router(jobs.router)
app.include_router(health.router)
app.include_router(presets.router)
app.include_router(projects.router)
app.include_router(wizard.router)
app.include_router(skeletal.router)

@app.get("/")
async def get_index():
    """Serve the SPA index page."""
    index_path = os.path.join(BASE_DIR, "frontend", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not found. Please verify the frontend files are in place."}
