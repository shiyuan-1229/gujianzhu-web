from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from config import DOCS_DIR, PROJECT_DIR
from rag import stream_answer


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    lang: str = "zh"
    history: List[Dict] = []


app = FastAPI(title="古建智寻 AI 导览 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/chat")
def chat(req: ChatRequest) -> StreamingResponse:
    def event_stream():
        try:
            for line in stream_answer(query=req.query, lang=req.lang, history=req.history):
                yield f"data: {line}\n\n"
        except Exception as exc:
            payload = {"type": "error", "data": str(exc)}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/files/{file_path:path}")
def get_file(file_path: str):
    target = (DOCS_DIR / file_path).resolve()
    if not str(target).startswith(str(DOCS_DIR.resolve())):
        raise HTTPException(status_code=400, detail="非法路径")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(path=target)


static_dir = PROJECT_DIR / "古建筑 2"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="site")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
