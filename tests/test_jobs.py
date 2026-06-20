import pytest
import time
import threading
from fastapi.testclient import TestClient
from backend.jobs import JobManager, JobStatus, JobType

def test_job_manager_crud():
    jm = JobManager()
    
    # 1. Create Job
    job_id = jm.create_job(JobType.DOWNLOAD, {"url": "http://example.com"})
    assert job_id is not None
    
    # 2. Get Job
    job = jm.get_job(job_id)
    assert job["id"] == job_id
    assert job["status"] == JobStatus.PENDING.value
    assert job["type"] == JobType.DOWNLOAD.value
    
    # 3. Update Progress
    jm.update_job_progress(job_id, 45)
    job = jm.get_job(job_id)
    assert job["progress"] == 45
    
    # 4. Update Status
    jm.update_job_status(job_id, JobStatus.RUNNING)
    job = jm.get_job(job_id)
    assert job["status"] == JobStatus.RUNNING.value
    
    # 5. Add Log
    jm.add_job_log(job_id, "Test log message")
    job = jm.get_job(job_id)
    assert "Test log message" in job["logs"]

def test_job_execution_success():
    jm = JobManager()
    job_id = jm.create_job(JobType.GENERATION, {})
    
    def dummy_task(jid, cancel_event):
        jm.update_job_progress(jid, 50)
        return {"output_file": "test.mp4"}
        
    jm.start_job(job_id, dummy_task)
    
    # Wait for completion (it's threaded, but should be fast)
    timeout = 5.0
    start_time = time.time()
    while time.time() - start_time < timeout:
        job = jm.get_job(job_id)
        if job["status"] in (JobStatus.COMPLETED.value, JobStatus.FAILED.value):
            break
        time.sleep(0.1)
        
    job = jm.get_job(job_id)
    assert job["status"] == JobStatus.COMPLETED.value
    assert job["progress"] == 100
    assert job["result"]["output_file"] == "test.mp4"

def test_job_execution_cancellation():
    jm = JobManager()
    job_id = jm.create_job(JobType.GENERATION, {})
    
    sync_event = threading.Event()
    
    def slow_task(jid, cancel_event):
        sync_event.set() # signal that we entered the task
        for _ in range(50):
            if cancel_event.is_set():
                return
            time.sleep(0.1)
            
    jm.start_job(job_id, slow_task)
    
    # Wait for thread execution to start
    assert sync_event.wait(timeout=2.0)
    
    # Cancel it
    jm.cancel_job(job_id)
    assert jm.is_cancelled(job_id) is True
    
    # Wait for worker to finish and update DB status
    timeout = 5.0
    start_time = time.time()
    while time.time() - start_time < timeout:
        job = jm.get_job(job_id)
        if job["status"] == JobStatus.CANCELLED.value:
            break
        time.sleep(0.1)
        
    job = jm.get_job(job_id)
    assert job["status"] == JobStatus.CANCELLED.value

def test_job_router_endpoints(client: TestClient):
    # Create a job first via JobManager to test GET/POST
    jm = JobManager()
    job_id = jm.create_job(JobType.GENERATION, {"name": "Router test"})
    
    # Test list
    res = client.get("/api/jobs")
    assert res.status_code == 200
    jobs_list = res.json()
    assert any(j["id"] == job_id for j in jobs_list)
    
    # Test retrieve
    res = client.get(f"/api/jobs/{job_id}")
    assert res.status_code == 200
    assert res.json()["id"] == job_id
    
    # Test cancel endpoint
    res = client.post(f"/api/jobs/{job_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] in ("ok", "cancellation_requested")
    
    job = jm.get_job(job_id)
    assert job["status"] == JobStatus.CANCELLED.value
