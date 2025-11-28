from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, JSONResponse

from app.services.session_manager import session_manager

router = APIRouter()


@router.get("/{session_id}/artifacts/json")
async def get_summary_json(session_id: str):
    """Get the final JSON summary for a session."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Return summary if available, otherwise generate basic one
    if session.summary:
        return JSONResponse(session.summary)

    # Generate basic summary
    summary = {
        "session_id": session_id,
        "turn_count": len([t for t in session.transcript if t.is_final]),
        "asset_count": len(session.assets),
        "has_knowledge_base": session.knowledge_base is not None,
    }

    return JSONResponse(summary)


@router.get("/{session_id}/artifacts/transcript")
async def get_transcript_json(session_id: str):
    """Get the transcript as JSON."""
    transcript = session_manager.get_transcript_json(session_id)
    if transcript is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return JSONResponse(transcript)


@router.get("/{session_id}/artifacts/transcript.txt")
async def get_transcript_txt(session_id: str):
    """Get the transcript as plain text."""
    transcript = session_manager.get_transcript_txt(session_id)
    if transcript is None:
        raise HTTPException(status_code=404, detail="Session not found")

    return PlainTextResponse(transcript)
