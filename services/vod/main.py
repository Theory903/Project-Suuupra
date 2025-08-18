from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import ffmpeg
import os
import aiofiles

app = FastAPI(
    title="VOD Service",
    description="Video-on-Demand service for encoding, transcoding, and streaming.",
    version="1.0.0",
)

VIDEO_DIR = "./videos"
if not os.path.exists(VIDEO_DIR):
    os.makedirs(VIDEO_DIR)

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """Uploads a video file for processing."""
    file_path = os.path.join(VIDEO_DIR, file.filename)
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024):
            await out_file.write(content)
    
    # Placeholder for video processing (encoding, transcoding, ABR)
    # In a real application, this would be an asynchronous task
    print(f"Video {file.filename} uploaded. Processing (placeholder)...")
    
    return {"message": "Video uploaded successfully", "filename": file.filename}

@app.get("/stream/{filename}")
async def stream_video(filename: str):
    """Streams a video file."""
    file_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    def iterfile():
        with open(file_path, mode="rb") as file_like:
            yield from file_like
            
    return StreamingResponse(iterfile(), media_type="video/mp4")

@app.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "ok"}
