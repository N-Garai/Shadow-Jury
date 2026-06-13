import uuid
import os
import json
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, Response, StreamingResponse

from backend.orchestrator.pipeline import ProjectJuryPipeline
from backend.schemas.models import FinalReport, PipelineStatus
from backend.github_fetcher.fetcher import GitHubFetcher

app = FastAPI(title="Shadow Jury", version="1.0.0")

_ALLOWED_ORIGINS = [
    "https://shadow-jury.onrender.com",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipelines: dict[str, ProjectJuryPipeline] = {}

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "shadow-jury"}


@app.post("/api/upload")
async def upload_files(
    files: list[UploadFile] = File(None),
    paste_text: Optional[str] = Form(None),
    github_url: Optional[str] = Form(None),
):
    pipeline_id = str(uuid.uuid4())
    files_content = []

    if files:
        for file in files:
            raw = await file.read()
            try:
                content = raw.decode("utf-8")
            except UnicodeDecodeError:
                content = f"[Binary file: {file.filename}, size: {len(raw)} bytes]"
            files_content.append({"name": file.filename, "content": content})

    github_data = None
    github_error = None
    if github_url and github_url.strip():
        fetcher = GitHubFetcher()
        try:
            github_data = await fetcher.fetch_repo(github_url.strip())
        except Exception as e:
            github_error = str(e)

    paste_text_value = paste_text if paste_text and paste_text.strip() else None

    pipeline = ProjectJuryPipeline()
    pipeline.upload_data = {
        "files_content": files_content,
        "paste_text": paste_text_value,
        "github_data": github_data,
    }
    pipelines[pipeline_id] = pipeline

    return {
        "pipeline_id": pipeline_id,
        "files_received": len(files_content),
        "paste_received": bool(paste_text_value),
        "github_data_fetched": github_data is not None,
        "github_error": github_error,
    }


@app.post("/api/run/{pipeline_id}")
async def run_pipeline(pipeline_id: str):
    if pipeline_id not in pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    pipeline = pipelines[pipeline_id]
    data = getattr(pipeline, "upload_data", None) or {}
    try:
        report = await pipeline.run(
            pipeline_id,
            data.get("files_content", []),
            data.get("paste_text"),
            data.get("github_data"),
        )
        pipeline._cached_report = report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"status": "completed", "report": report.model_dump()}


@app.post("/api/run/stream/{pipeline_id}")
async def run_pipeline_stream(pipeline_id: str):
    if pipeline_id not in pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    pipeline = pipelines[pipeline_id]
    data = getattr(pipeline, "upload_data", None) or {}

    async def event_stream():
        try:
            async for event in pipeline.run_stream(
                pipeline_id,
                data.get("files_content", []),
                data.get("paste_text"),
                data.get("github_data"),
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'description': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/status/{pipeline_id}")
async def get_status(pipeline_id: str):
    if pipeline_id not in pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    pipeline = pipelines[pipeline_id]
    status = pipeline.get_status()
    return status.model_dump()


@app.get("/api/report/{pipeline_id}")
async def get_report(pipeline_id: str):
    if pipeline_id not in pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    pipeline = pipelines[pipeline_id]
    status = pipeline.get_status()

    if status.state != "completed":
        raise HTTPException(status_code=400, detail="Pipeline not yet completed")

    report = getattr(pipeline, "_cached_report", None)
    if report is None:
        raise HTTPException(status_code=500, detail="Report not found in cache")

    return report.model_dump()


@app.get("/api/download/{pipeline_id}")
async def download_report(pipeline_id: str):
    if pipeline_id not in pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    pipeline = pipelines[pipeline_id]
    status = pipeline.get_status()

    if status.state != "completed":
        raise HTTPException(status_code=400, detail="Pipeline not yet completed")

    report = getattr(pipeline, "_cached_report", None)
    if report is None:
        raise HTTPException(status_code=500, detail="Report not found in cache")

    report_path = os.path.join(os.path.dirname(__file__), f"_reports/{pipeline_id}.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report.model_dump(), f, indent=2)

    return FileResponse(report_path, media_type="application/json",
                        filename=f"shadow-jury-report-{pipeline_id[:8]}.json")


@app.api_route("/{full_path:path}", methods=["GET"], include_in_schema=False)
async def serve_frontend(full_path: str):
    file_path = FRONTEND_DIR / full_path
    if file_path.exists() and file_path.is_file():
        content = file_path.read_bytes()
        media_type = {
            ".js": "application/javascript",
            ".css": "text/css",
            ".html": "text/html",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".ico": "image/x-icon",
        }.get(file_path.suffix, "application/octet-stream")
        return Response(content=content, media_type=media_type)
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>Frontend not found. Run from project root.</h1>", status_code=404)
    return HTMLResponse(index_file.read_text(encoding="utf-8"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
