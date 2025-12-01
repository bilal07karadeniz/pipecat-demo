from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class AssetType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"


class Asset(BaseModel):
    asset_id: str
    title: str
    type: AssetType
    url: str
    poster_url: Optional[str] = None
    duration_sec: Optional[float] = None
    start_time: Optional[float] = None  # For video clips - start position in seconds
    end_time: Optional[float] = None    # For video clips - end position in seconds


class TranscriptEntry(BaseModel):
    speaker: str  # "user" or "bot"
    text: str
    ts: str  # ISO timestamp
    is_final: bool = True


class SessionState(BaseModel):
    session_id: str
    prompt: str
    assets: List[Asset] = []
    knowledge_base: Optional[Dict[str, Any]] = None
    transcript: List[TranscriptEntry] = []
    summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    ended_at: Optional[datetime] = None


class SessionCreate(BaseModel):
    prompt: str


class SessionResponse(BaseModel):
    session_id: str
    webrtc_url: str
    asset_manifest: List[Asset]
    frontend_link: Optional[str] = None


class SessionListItem(BaseModel):
    session_id: str
    prompt: str
    created_at: datetime
    ended_at: Optional[datetime] = None
    is_active: bool
    asset_count: int
    transcript_count: int
    frontend_link: str
