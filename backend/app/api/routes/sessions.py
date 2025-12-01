import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from typing import List, Optional

from app.models.session import SessionResponse, SessionListItem
from app.services.session_manager import session_manager
from app.services.asset_processor import asset_processor
from app.services.knowledge_base import KnowledgeBase
from app.config import get_settings

router = APIRouter()


def get_frontend_link(session_id: str) -> str:
    """Generate frontend URL for a session."""
    settings = get_settings()
    frontend_url = settings.frontend_url.rstrip("/")
    return f"{frontend_url}/?session={session_id}"


@router.get("", response_model=List[SessionListItem])
async def list_sessions(
    active_only: bool = Query(False, description="Filter for active sessions only")
):
    """
    List all sessions.

    - active_only: If true, only return sessions that haven't ended
    """
    sessions = session_manager.get_all_sessions(active_only=active_only)

    return [
        SessionListItem(
            session_id=s.session_id,
            prompt=s.prompt[:100] + "..." if len(s.prompt) > 100 else s.prompt,
            created_at=s.created_at,
            ended_at=s.ended_at,
            is_active=s.ended_at is None,
            asset_count=len(s.assets),
            transcript_count=len([t for t in s.transcript if t.is_final]),
            frontend_link=get_frontend_link(s.session_id),
        )
        for s in sessions
    ]


@router.post("", response_model=SessionResponse)
async def create_session(
    prompt: str = Form(...),
    assets: List[UploadFile] = File(...),
    kb: Optional[UploadFile] = File(None),
):
    """
    Create a new interview session.

    - prompt: The instructions for the bot to follow
    - assets: 1..N images, PowerPoint, or video files
    - kb: Optional knowledge base (YAML or JSON)
    """
    session_id = str(uuid.uuid4())

    # Process assets
    try:
        processed_assets = await asset_processor.process_assets(session_id, assets)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to process assets: {str(e)}"
        )

    if not processed_assets:
        raise HTTPException(
            status_code=400, detail="At least one valid asset is required"
        )

    # Process knowledge base
    kb_data = None
    if kb and kb.filename:
        try:
            content = await kb.read()
            knowledge_base = KnowledgeBase.from_file_content(content, kb.filename)
            kb_data = knowledge_base.to_dict()
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to parse knowledge base: {str(e)}"
            )

    # Create session
    session = session_manager.create_session(
        session_id=session_id,
        prompt=prompt,
        assets=processed_assets,
        knowledge_base=kb_data,
    )

    return SessionResponse(
        session_id=session_id,
        webrtc_url=f"/api/webrtc/offer/{session_id}",
        asset_manifest=processed_assets,
        frontend_link=get_frontend_link(session_id),
    )


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get session details including assets for frontend initialization."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "webrtc_url": f"/api/webrtc/offer/{session_id}",
        "asset_manifest": [a.model_dump() for a in session.assets],
        "created_at": session.created_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "is_active": session.ended_at is None,
        "transcript_count": len(session.transcript),
        "frontend_link": get_frontend_link(session_id),
    }


@router.get("/{session_id}/link")
async def get_session_link(session_id: str):
    """Get the frontend URL for a session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "frontend_link": get_frontend_link(session_id),
        "is_active": session.ended_at is None,
    }


@router.post("/{session_id}/end")
async def end_session(session_id: str):
    """End an active session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Generate basic summary
    summary = {
        "session_id": session_id,
        "turn_count": len([t for t in session.transcript if t.is_final]),
        "duration_seconds": None,
    }

    if session.created_at:
        from datetime import datetime

        duration = datetime.utcnow() - session.created_at
        summary["duration_seconds"] = int(duration.total_seconds())

    session_manager.end_session(session_id, summary)

    return {"status": "ended", "summary": summary}
