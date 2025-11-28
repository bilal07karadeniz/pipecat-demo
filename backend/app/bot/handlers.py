from typing import Callable, Awaitable, Optional
from app.services.session_manager import session_manager
from app.services.knowledge_base import KnowledgeBase


class BotHandlers:
    """LLM function call handlers for the interview bot."""

    def __init__(
        self,
        session_id: str,
        knowledge_base: Optional[KnowledgeBase],
        send_client_message: Callable[[dict], Awaitable[None]],
    ):
        self.session_id = session_id
        self.kb = knowledge_base
        self.send_client_message = send_client_message
        self._current_asset: Optional[str] = None

    async def show_asset(
        self,
        asset_id: str,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
    ) -> dict:
        """Display an asset (image/slide/video) to the user.

        For videos, optional start_time and end_time can specify a clip to play.
        """
        session = session_manager.get_session(self.session_id)

        if not session:
            return {"success": False, "message": "Session not found"}

        # Verify asset exists
        asset = next((a for a in session.assets if a.asset_id == asset_id), None)

        if asset:
            self._current_asset = asset_id
            message = {
                "type": "show_asset",
                "asset_id": asset_id,
                "asset": asset.model_dump(),
            }
            # Add clip times if provided (for video playback)
            if start_time is not None:
                message["start_time"] = start_time
            if end_time is not None:
                message["end_time"] = end_time

            await self.send_client_message(message)

            clip_info = ""
            if start_time is not None or end_time is not None:
                clip_info = f" (clip: {start_time or 0}s - {end_time or 'end'})"
            return {"success": True, "message": f"Now showing {asset.title}{clip_info}"}
        else:
            return {"success": False, "message": f"Asset {asset_id} not found"}

    async def hide_asset(self) -> dict:
        """Hide the currently displayed asset."""
        self._current_asset = None
        await self.send_client_message({"type": "hide_asset"})
        return {"success": True, "message": "Asset hidden"}

    async def kb_lookup(self, term: str) -> dict:
        """Look up a term in the knowledge base."""
        if not self.kb:
            return {
                "found": False,
                "message": "No knowledge base available for this session.",
            }

        result = self.kb.lookup(term)

        if result:
            # Format response for natural speech
            response = result["definition"]
            if result.get("example"):
                response += f" For example: {result['example']}"

            return {
                "found": True,
                "term": result["term"],
                "definition": response,
                "why": result.get("why"),
            }
        else:
            return {
                "found": False,
                "message": f"I don't have a definition for '{term}' in my knowledge base.",
            }
