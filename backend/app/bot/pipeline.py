import asyncio
from typing import Callable, Awaitable, Optional

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.frames.frames import EndFrame, LLMMessagesFrame, TranscriptionFrame, InterimTranscriptionFrame
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.processors.transcript_processor import TranscriptProcessor
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.groq.llm import GroqLLMService

from app.config import get_settings
from app.models.session import SessionState
from app.services.knowledge_base import KnowledgeBase
from app.services.session_manager import session_manager
from app.bot.handlers import BotHandlers
from app.bot.prompts import build_system_prompt


class TranscriptForwarder(FrameProcessor):
    """Forward transcription frames to frontend in real-time (including interim results)."""

    def __init__(
        self,
        session_id: str,
        send_message: Callable[[dict], Awaitable[None]],
    ):
        super().__init__()
        self.session_id = session_id
        self.send_message = send_message

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        # Handle interim transcription frames (partial results)
        if isinstance(frame, InterimTranscriptionFrame):
            text = frame.text.strip() if frame.text else ""
            if text:
                await self.send_message({
                    "type": "transcript",
                    "speaker": "user",
                    "text": text,
                    "is_final": False,
                })

        # Handle final transcription frames
        elif isinstance(frame, TranscriptionFrame):
            text = frame.text.strip() if frame.text else ""
            if text:
                await self.send_message({
                    "type": "transcript",
                    "speaker": "user",
                    "text": text,
                    "is_final": True,
                })
                # Only persist final transcripts to session storage
                session_manager.add_transcript_entry(
                    self.session_id, "user", text, True
                )

        await self.push_frame(frame, direction)


class InterviewBot:
    """Pipecat-based interview bot with Deepgram STT, Cartesia TTS, and Groq LLM."""

    def __init__(
        self,
        session: SessionState,
        knowledge_base: Optional[KnowledgeBase],
        send_client_message: Callable[[dict], Awaitable[None]],
    ):
        self.session = session
        self.kb = knowledge_base
        self.send_client_message = send_client_message
        self._settings = get_settings()
        self._task: Optional[PipelineTask] = None

    def _build_tools(self) -> list:
        """Build tool definitions for LLM function calling."""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "show_asset",
                    "description": "Display an image, slide, or video to the user. For videos, you can optionally specify start_time and end_time to play a specific clip.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "asset_id": {
                                "type": "string",
                                "description": "The ID of the asset to display",
                            },
                            "start_time": {
                                "type": "number",
                                "description": "For videos only: start position in seconds (optional)",
                            },
                            "end_time": {
                                "type": "number",
                                "description": "For videos only: end position in seconds (optional)",
                            },
                        },
                        "required": ["asset_id"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "hide_asset",
                    "description": "Hide the currently displayed asset",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    },
                },
            },
        ]

        if self.kb:
            tools.append(
                {
                    "type": "function",
                    "function": {
                        "name": "kb_lookup",
                        "description": "Look up a term in the knowledge base to get its definition",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "term": {
                                    "type": "string",
                                    "description": "The term to look up",
                                }
                            },
                            "required": ["term"],
                        },
                    },
                }
            )

        return tools

    async def create_pipeline(self, transport) -> PipelineTask:
        """Create and return the Pipecat pipeline task."""

        # Initialize STT service (Deepgram)
        stt = DeepgramSTTService(
            api_key=self._settings.deepgram_api_key,
            model="nova-2-general",
            language="en",
        )

        # Initialize TTS service (Cartesia)
        tts = CartesiaTTSService(
            api_key=self._settings.cartesia_api_key,
            voice_id=self._settings.cartesia_voice_id,
        )

        # Initialize LLM service (OpenAI or Groq based on config)
        if self._settings.llm_provider == "openai":
            llm = OpenAILLMService(
                api_key=self._settings.openai_api_key,
                model="gpt-4o-mini",
            )
        else:
            llm = GroqLLMService(
                api_key=self._settings.groq_api_key,
                model="llama-3.3-70b-versatile",
            )

        # Build system prompt
        kb_terms = self.kb.get_terms_list() if self.kb else None
        system_prompt = build_system_prompt(
            user_prompt=self.session.prompt,
            assets=self.session.assets,
            kb_terms=kb_terms,
        )

        # Build tools
        tools = self._build_tools()

        # Create context
        messages = [{"role": "system", "content": system_prompt}]

        context = OpenAILLMContext(messages=messages, tools=tools)
        context_aggregator = llm.create_context_aggregator(context)

        # Setup function handlers
        handlers = BotHandlers(
            session_id=self.session.session_id,
            knowledge_base=self.kb,
            send_client_message=self.send_client_message,
        )

        # Register function handlers
        async def handle_show_asset(function_name, tool_call_id, args, llm, context, result_callback):
            result = await handlers.show_asset(
                asset_id=args.get("asset_id", ""),
                start_time=args.get("start_time"),
                end_time=args.get("end_time"),
            )
            await result_callback(result)

        async def handle_hide_asset(function_name, tool_call_id, args, llm, context, result_callback):
            result = await handlers.hide_asset()
            await result_callback(result)

        async def handle_kb_lookup(function_name, tool_call_id, args, llm, context, result_callback):
            result = await handlers.kb_lookup(args.get("term", ""))
            await result_callback(result)

        llm.register_function("show_asset", handle_show_asset)
        llm.register_function("hide_asset", handle_hide_asset)
        if self.kb:
            llm.register_function("kb_lookup", handle_kb_lookup)

        # Setup transcript forwarder for real-time user transcripts (including interim)
        transcript_forwarder = TranscriptForwarder(
            session_id=self.session.session_id,
            send_message=self.send_client_message,
        )

        # Setup transcript processor for LLM context
        transcript = TranscriptProcessor()

        # Register transcript update handler for bot messages only
        # (User messages are handled by TranscriptForwarder above)
        @transcript.event_handler("on_transcript_update")
        async def on_transcript_update(processor, frame):
            # frame.messages contains the new transcript messages
            for msg in frame.messages:
                # Only handle bot messages here (user handled by TranscriptForwarder)
                if msg.role == "assistant" and msg.content and msg.content.strip():
                    session_manager.add_transcript_entry(
                        self.session.session_id, "bot", msg.content, True
                    )
                    await self.send_client_message({
                        "type": "transcript",
                        "speaker": "bot",
                        "text": msg.content,
                        "is_final": True,
                    })

        # Build pipeline with transcript processors
        # TranscriptForwarder is placed right after STT to capture interim results
        pipeline = Pipeline(
            [
                transport.input(),
                stt,
                transcript_forwarder,  # Captures interim user transcripts
                transcript.user(),
                context_aggregator.user(),
                llm,
                tts,
                transport.output(),
                transcript.assistant(),
                context_aggregator.assistant(),
            ]
        )

        # Create task with interruption support
        self._task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
            ),
        )

        # Setup event handlers for SmallWebRTCTransport
        @transport.event_handler("on_client_connected")
        async def on_client_connected(transport, client):
            # Short delay for connection stabilization
            await asyncio.sleep(0.5)
            # Send initial greeting when client connects
            await self._task.queue_frames(
                [
                    LLMMessagesFrame(
                        [{"role": "user", "content": "Please start the interview with a brief greeting."}]
                    )
                ]
            )

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, client):
            await self._task.queue_frame(EndFrame())

        return self._task

    async def stop(self):
        """Stop the bot pipeline."""
        if self._task:
            await self._task.queue_frame(EndFrame())
