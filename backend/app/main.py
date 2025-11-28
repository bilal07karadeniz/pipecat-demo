from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from app.config import get_settings
from app.api.routes import sessions, artifacts, webrtc

# Path to frontend dist
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    settings = get_settings()
    settings.ensure_storage_dirs()
    print(f"Storage path: {settings.storage_path}")
    print(f"Server starting on {settings.host}:{settings.port}")
    yield
    # Shutdown
    print("Server shutting down...")


app = FastAPI(
    title="Pipecat Interview Bot",
    description="Voice interview bot with Pipecat",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploaded/generated assets (slides, etc.)
settings = get_settings()
assets_path = Path(settings.storage_path) / "assets"
assets_path.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=str(assets_path)), name="storage_assets")

# Include routers
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(artifacts.router, prefix="/api/sessions", tags=["artifacts"])
app.include_router(webrtc.router, prefix="/api/webrtc", tags=["webrtc"])


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Serve frontend static files if they exist
if FRONTEND_DIR.exists():
    # Mount static assets (JS, CSS, etc.)
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="frontend_assets")

    @app.get("/")
    async def serve_frontend():
        """Serve frontend index.html."""
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve frontend for SPA routing (catch-all for non-API routes)."""
        # Check if it's a static file
        file_path = FRONTEND_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for SPA routing
        return FileResponse(FRONTEND_DIR / "index.html")
else:
    @app.get("/")
    async def root():
        """Root endpoint when frontend not built."""
        return {
            "name": "Pipecat Interview Bot",
            "version": "1.0.0",
            "status": "running",
            "note": "Frontend not built. Run 'npm run build' in frontend directory."
        }


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
