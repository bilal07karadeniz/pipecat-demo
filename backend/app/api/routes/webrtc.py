import asyncio
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.transports.base_transport import TransportParams
from pipecat.audio.vad.silero import SileroVADAnalyzer, VADParams
from pipecat.pipeline.runner import PipelineRunner

from app.services.session_manager import session_manager
from app.services.knowledge_base import KnowledgeBase
from app.bot.pipeline import InterviewBot

router = APIRouter()

# Store active connections
active_connections: Dict[str, Any] = {}


@router.post("/offer/{session_id}")
async def webrtc_offer(session_id: str, request: Request):
    """Handle WebRTC offer for establishing connection."""

    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Parse SDP offer from request body
    body = await request.json()
    sdp = body.get("sdp")
    sdp_type = body.get("type", "offer")

    if not sdp:
        raise HTTPException(status_code=400, detail="SDP offer required")

    # Create WebRTC connection with STUN server for NAT traversal
    webrtc_connection = SmallWebRTCConnection(
        ice_servers=["stun:stun.l.google.com:19302"]
    )

    # Initialize the connection with the SDP offer
    await webrtc_connection.initialize(sdp, sdp_type)

    # Create transport with the connection
    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.8)),
        ),
    )

    # Initialize knowledge base
    kb = None
    if session.knowledge_base:
        kb = KnowledgeBase(session.knowledge_base)

    # Message queue for client communication
    message_queue: asyncio.Queue = asyncio.Queue()

    async def send_client_message(message: dict):
        await message_queue.put(message)

    # Create bot
    bot = InterviewBot(
        session=session,
        knowledge_base=kb,
        send_client_message=send_client_message,
    )

    # Create pipeline task with the transport
    task = await bot.create_pipeline(transport)

    # Store connection
    active_connections[session_id] = {
        "connection": webrtc_connection,
        "transport": transport,
        "task": task,
        "bot": bot,
        "message_queue": message_queue,
    }

    # Connect the WebRTC connection
    await webrtc_connection.connect()

    # Get the answer SDP
    answer = webrtc_connection.get_answer()
    if not answer:
        raise HTTPException(status_code=500, detail="Failed to generate WebRTC answer")

    # Run pipeline in background
    runner = PipelineRunner()

    async def run_pipeline():
        try:
            await runner.run(task)
        except Exception as e:
            print(f"Pipeline error: {e}")
        finally:
            if session_id in active_connections:
                del active_connections[session_id]

    asyncio.create_task(run_pipeline())

    return JSONResponse({"sdp": answer["sdp"], "type": answer["type"], "session_id": session_id})


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time messages from bot to client."""
    await websocket.accept()

    if session_id not in active_connections:
        await websocket.close(code=4004, reason="Session not found")
        return

    conn_data = active_connections[session_id]
    message_queue = conn_data["message_queue"]

    try:
        while True:
            # Check for messages to send
            try:
                message = await asyncio.wait_for(message_queue.get(), timeout=0.1)
                await websocket.send_json(message)
            except asyncio.TimeoutError:
                pass

            # Check for incoming messages
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                # Handle incoming messages if needed
                incoming = json.loads(data)
                if incoming.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")


@router.post("/end/{session_id}")
async def end_webrtc_session(session_id: str):
    """End an active WebRTC session."""

    if session_id in active_connections:
        conn_data = active_connections[session_id]
        bot = conn_data.get("bot")

        if bot:
            await bot.stop()

        del active_connections[session_id]

    # End session in manager
    session = session_manager.get_session(session_id)
    if session and not session.ended_at:
        session_manager.end_session(session_id)

    return {"status": "ended"}


@router.get("/status/{session_id}")
async def get_connection_status(session_id: str):
    """Get the status of a WebRTC connection."""
    is_active = session_id in active_connections

    return {
        "session_id": session_id,
        "is_active": is_active,
    }
