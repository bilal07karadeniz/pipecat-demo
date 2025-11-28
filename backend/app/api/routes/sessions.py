import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional

from app.models.session import SessionResponse
from app.services.session_manager import session_manager
from app.services.asset_processor import asset_processor
from app.services.knowledge_base import KnowledgeBase

router = APIRouter()


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
    )


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get session details."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "created_at": session.created_at.isoformat(),
        "ended_at": session.ended_at.isoformat() if session.ended_at else None,
        "asset_count": len(session.assets),
        "transcript_count": len(session.transcript),
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
