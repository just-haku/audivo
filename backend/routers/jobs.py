import asyncio
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from backend.jobs import JobManager, JobStatus, JobType

router = APIRouter(tags=["jobs"])
job_manager = JobManager()

@router.get("/api/jobs")
async def list_jobs(
    type: str = Query(None, description="Filter by job type"),
    status: str = Query(None, description="Filter by status"),
    limit: int = Query(50, description="Max number of jobs to return"),
    offset: int = Query(0, description="Pagination offset")
):
    """List jobs with optional filtering."""
    try:
        return job_manager.list_jobs(job_type=type, status=status, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    """Retrieve details of a specific job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] not in (JobStatus.PENDING.value, JobStatus.RUNNING.value, JobStatus.AWAITING_REVIEW.value):
        raise HTTPException(status_code=400, detail=f"Job is not in a cancellable state: {job['status']}")
        
    job_manager.cancel_job(job_id)
    return {"status": "cancellation_requested", "job_id": job_id}

@router.post("/api/jobs/{job_id}/retry")
async def retry_job(job_id: str):
    """Retry a failed or cancelled job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] not in (JobStatus.FAILED.value, JobStatus.CANCELLED.value):
        raise HTTPException(status_code=400, detail=f"Job cannot be retried in its current state: {job['status']}")
        
    # Re-submit the job based on type
    job_type = job["type"]
    params = job["params"]
    
    # Update status to pending/running
    job_manager.update_job_status(job_id, JobStatus.PENDING, error="", result={})
    job_manager.update_job_progress(job_id, 0)
    job_manager.add_job_log(job_id, "Job retried by user.")
    
    if job_type == JobType.GENERATION.value:
        from backend.routers.generation import start_generation_job
        start_generation_job(job_id, params)
    elif job_type == JobType.DOWNLOAD.value:
        from backend.routers.materials import start_download_job
        start_download_job(job_id, params)
    else:
        raise HTTPException(status_code=400, detail=f"Retry is not supported for job type: {job_type}")
        
    return {"status": "retried", "job_id": job_id}

@router.get("/api/jobs/{job_id}/logs")
async def get_job_logs(job_id: str):
    """Stream real-time logs for a specific job via SSE."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def log_generator():
        queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def callback(msg):
            loop.call_soon_threadsafe(queue.put_nowait, msg)

        job_manager.add_log_subscriber(job_id, callback)
        try:
            # 1. Yield existing logs
            existing_job = job_manager.get_job(job_id)
            if existing_job and existing_job.get("logs"):
                for line in existing_job["logs"].splitlines():
                    yield f"data: {line}\n\n"

            # 2. If already finished, return immediately
            if existing_job and existing_job["status"] in (JobStatus.COMPLETED.value, JobStatus.FAILED.value, JobStatus.CANCELLED.value):
                return

            # 3. Stream active logs
            while True:
                msg = await queue.get()
                yield f"data: {msg}\n\n"
                
                # Check if job finished
                job_now = job_manager.get_job(job_id)
                if job_now and job_now["status"] in (JobStatus.COMPLETED.value, JobStatus.FAILED.value, JobStatus.CANCELLED.value):
                    # Flush queue
                    await asyncio.sleep(0.5)
                    while not queue.empty():
                        msg = queue.get_nowait()
                        yield f"data: {msg}\n\n"
                    break
        finally:
            job_manager.remove_log_subscriber(job_id, callback)

    return StreamingResponse(log_generator(), media_type="text/event-stream")

@router.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job record."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if job["status"] in (JobStatus.PENDING.value, JobStatus.RUNNING.value):
        raise HTTPException(status_code=400, detail="Cannot delete a running or pending job. Cancel it first.")
        
    job_manager.delete_job(job_id)
    return {"status": "deleted", "job_id": job_id}

@router.delete("/api/jobs")
async def wipe_all_jobs():
    """Wipe all job records."""
    try:
        job_manager.wipe_all()
        return {"status": "success", "message": "All jobs wiped."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/cache/stats")
async def get_cache_stats():
    """Get size and stats of cached TTS audio."""
    try:
        return job_manager.get_cache_stats()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/cache")
async def clear_cache():
    """Clear cached TTS audio files."""
    try:
        job_manager.clear_cache()
        return {"status": "success", "message": "TTS cache cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
