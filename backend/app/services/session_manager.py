from typing import Dict, Optional, List
from datetime import datetime
import json
from pathlib import Path

from app.models.session import SessionState, Asset, TranscriptEntry
from app.config import get_settings


class SessionManager:
    """Manages interview session state with file-based persistence."""

    def __init__(self):
        self._sessions: Dict[str, SessionState] = {}

    def _get_session_path(self, session_id: str) -> Path:
        settings = get_settings()
        return Path(settings.storage_path) / "sessions" / f"{session_id}.json"

    def create_session(
        self,
        session_id: str,
        prompt: str,
        assets: List[Asset],
        knowledge_base: Optional[dict] = None,
    ) -> SessionState:
        """Create a new session."""
        session = SessionState(
            session_id=session_id,
            prompt=prompt,
            assets=assets,
            knowledge_base=knowledge_base,
            transcript=[],
            created_at=datetime.utcnow(),
        )
        self._sessions[session_id] = session
        self._persist_session(session)
        return session

    def get_session(self, session_id: str) -> Optional[SessionState]:
        """Get session by ID, loading from disk if needed."""
        if session_id not in self._sessions:
            self._load_session(session_id)
        return self._sessions.get(session_id)

    def add_transcript_entry(
        self,
        session_id: str,
        speaker: str,
        text: str,
        is_final: bool = True,
    ) -> None:
        """Add a transcript entry to the session."""
        session = self.get_session(session_id)
        if session:
            entry = TranscriptEntry(
                speaker=speaker,
                text=text,
                ts=datetime.utcnow().isoformat() + "Z",
                is_final=is_final,
            )
            session.transcript.append(entry)
            self._persist_session(session)

    def update_last_transcript(
        self,
        session_id: str,
        speaker: str,
        text: str,
        is_final: bool = False,
    ) -> None:
        """Update the last transcript entry if it's from the same speaker and not final."""
        session = self.get_session(session_id)
        if session and session.transcript:
            last = session.transcript[-1]
            if last.speaker == speaker and not last.is_final:
                session.transcript[-1] = TranscriptEntry(
                    speaker=speaker,
                    text=text,
                    ts=last.ts,
                    is_final=is_final,
                )
                self._persist_session(session)
                return
        # If no match, add new entry
        self.add_transcript_entry(session_id, speaker, text, is_final)

    def end_session(self, session_id: str, summary: Optional[dict] = None) -> None:
        """End a session and optionally add summary."""
        session = self.get_session(session_id)
        if session:
            session.ended_at = datetime.utcnow()
            if summary:
                session.summary = summary
            self._persist_session(session)

    def get_transcript_json(self, session_id: str) -> Optional[dict]:
        """Get transcript in JSON format."""
        session = self.get_session(session_id)
        if not session:
            return None

        final_turns = [
            {"speaker": t.speaker, "text": t.text, "ts": t.ts}
            for t in session.transcript
            if t.is_final
        ]

        return {"session_id": session_id, "turns": final_turns}

    def get_transcript_txt(self, session_id: str) -> Optional[str]:
        """Get transcript as plain text."""
        session = self.get_session(session_id)
        if not session:
            return None

        lines = []
        for t in session.transcript:
            if t.is_final:
                speaker = "Maya" if t.speaker == "bot" else "You"
                lines.append(f"[{t.ts}] {speaker}: {t.text}")

        return "\n".join(lines)

    def _persist_session(self, session: SessionState) -> None:
        """Save session to disk."""
        path = self._get_session_path(session.session_id)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = session.model_dump(mode="json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    def _load_session(self, session_id: str) -> None:
        """Load session from disk."""
        path = self._get_session_path(session_id)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Convert datetime strings back
                if data.get("created_at"):
                    data["created_at"] = datetime.fromisoformat(
                        data["created_at"].replace("Z", "+00:00")
                    )
                if data.get("ended_at"):
                    data["ended_at"] = datetime.fromisoformat(
                        data["ended_at"].replace("Z", "+00:00")
                    )
                self._sessions[session_id] = SessionState(**data)


# Singleton instance
session_manager = SessionManager()
