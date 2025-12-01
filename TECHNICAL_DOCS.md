# Pipecat Voice Interview Bot - Technical Documentation

**Author:** Bilal Karadeniz
**Version:** 1.0
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Voice Pipeline](#voice-pipeline)
6. [WebRTC Communication](#webrtc-communication)
7. [Asset Processing](#asset-processing)
8. [Session Management](#session-management)
9. [Configuration](#configuration)
10. [Deployment](#deployment)

---

## Overview

This project is a real-time AI-powered voice interview application. It enables interactive voice conversations between users and an AI interviewer named "Maya". The system combines speech-to-text, large language models, and text-to-speech to create a natural conversational experience.

The application supports displaying visual assets (images, slides, videos) during the interview, looking up terms from a knowledge base, and generating downloadable transcripts.

### Core Technologies

The backend runs on FastAPI with Python 3.11+, using the Pipecat framework for voice pipeline orchestration. The frontend is built with React 18 and TypeScript, featuring a 3D audio visualization using Three.js.

Speech recognition is handled by Deepgram's Nova 2 model, providing low-latency transcription with interim results. Text-to-speech uses Cartesia for natural-sounding voice synthesis. The LLM layer supports both OpenAI (GPT-4o-mini) and Groq (Llama 3.3 70B) as configurable providers.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│  ┌───────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐ │
│  │ SessionUI │  │  AudioOrb    │  │ Transcript│  │  Asset    │ │
│  │  Setup    │  │  (Three.js)  │  │  Panel    │  │  Viewer   │ │
│  └───────────┘  └──────────────┘  └───────────┘  └───────────┘ │
│         │              │                │              │        │
│         └──────────────┴────────────────┴──────────────┘        │
│                              │                                   │
│                    WebRTC + WebSocket                           │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Pipecat Pipeline                        │  │
│  │  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   │  │
│  │  │Deepgram │ → │   LLM   │ → │Cartesia │ → │ WebRTC  │   │  │
│  │  │  STT    │   │ OpenAI/ │   │   TTS   │   │Transport│   │  │
│  │  │         │   │  Groq   │   │         │   │         │   │  │
│  │  └─────────┘   └─────────┘   └─────────┘   └─────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │   Session    │  │    Asset      │  │   Knowledge Base    │  │
│  │   Manager    │  │   Processor   │  │      Service        │  │
│  └──────────────┘  └───────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

When a user speaks, the audio travels through WebRTC to the backend. Deepgram transcribes the speech in real-time, sending both interim and final results. The transcript goes to the LLM (either OpenAI or Groq), which generates a response. If the LLM decides to show an asset or look up a term, it calls the appropriate function. The response text is sent to Cartesia for speech synthesis, and the audio streams back to the user through WebRTC.

Meanwhile, WebSocket messages keep the frontend updated with transcripts, asset display commands, and agent state changes for the visualization.

---

## Backend Implementation

### Project Structure

```
backend/
├── app/
│   ├── api/routes/
│   │   ├── sessions.py      # Session CRUD endpoints
│   │   ├── webrtc.py        # WebRTC signaling & connection
│   │   └── artifacts.py     # Transcript/summary downloads
│   ├── bot/
│   │   ├── pipeline.py      # Pipecat pipeline configuration
│   │   ├── handlers.py      # Function call handlers
│   │   └── prompts.py       # System prompt builder
│   ├── services/
│   │   ├── session_manager.py   # Session persistence
│   │   ├── asset_processor.py   # File conversion
│   │   └── knowledge_base.py    # Term lookup
│   ├── models/
│   │   └── session.py       # Data models
│   ├── config.py            # Environment settings
│   └── main.py              # FastAPI application
├── storage/                  # Runtime data
├── requirements.txt
└── Dockerfile
```

### Main Application (main.py)

The FastAPI app initializes with CORS middleware for cross-origin requests. On startup, it creates the storage directories for sessions and assets. The app mounts three routers: sessions for interview management, webrtc for real-time communication, and artifacts for downloading transcripts.

Static files from the storage directory are served at `/storage`, allowing the frontend to load uploaded images and videos directly.

### Configuration (config.py)

Settings are managed through Pydantic's BaseSettings, automatically loading from environment variables or a `.env` file:

```python
class Settings(BaseSettings):
    # API Keys
    deepgram_api_key: str = ""
    cartesia_api_key: str = ""
    cartesia_voice_id: str = "a0e99841-438c-4a64-b679-ae501e7d6091"

    # LLM Configuration
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    llm_provider: str = "openai"

    # Server
    storage_path: str = "./storage"
    host: str = "0.0.0.0"
    port: int = 8000
```

The `llm_provider` setting switches between OpenAI and Groq at runtime without code changes.

### Data Models (models/session.py)

The session model tracks everything about an interview:

```python
class SessionState(BaseModel):
    session_id: str
    prompt: str                        # User's interview instructions
    assets: List[Asset]                # Uploaded files
    knowledge_base: Optional[Dict]     # Term definitions
    transcript: List[TranscriptEntry]  # Conversation history
    created_at: datetime
    ended_at: Optional[datetime]
```

Assets have their own model with support for video clips:

```python
class Asset(BaseModel):
    asset_id: str          # e.g., "slide-001" or "img-a1b2c3d4"
    title: str             # Display name
    type: AssetType        # "image" or "video"
    url: str               # Storage path
    duration_sec: float    # Video length (optional)
    start_time: float      # Clip start (optional)
    end_time: float        # Clip end (optional)
```

### API Endpoints

#### Session Creation

`POST /api/sessions` accepts multipart form data with the interview prompt, asset files, and an optional knowledge base file. The endpoint processes uploads, converts documents to images, and returns a session response with the asset manifest.

```python
@router.post("/sessions")
async def create_session(
    prompt: str = Form(...),
    assets: List[UploadFile] = File(...),
    kb: Optional[UploadFile] = File(None)
):
    session_id = str(uuid.uuid4())
    processed_assets = await asset_processor.process_assets(session_id, assets)
    # ... create and persist session
    return SessionResponse(session_id=session_id, assets=processed_assets)
```

#### WebRTC Signaling

`POST /api/webrtc/offer/{session_id}` handles the WebRTC handshake. It receives the client's SDP offer, creates a peer connection with the Pipecat transport, builds the voice pipeline, and returns the SDP answer.

The WebSocket endpoint `WS /api/webrtc/ws/{session_id}` delivers real-time messages to the frontend: transcripts, asset commands, and agent state updates.

#### Artifacts

Three endpoints serve session data for download:
- `GET /api/sessions/{id}/artifacts/transcript` returns JSON transcript
- `GET /api/sessions/{id}/artifacts/transcript.txt` returns plain text
- `GET /api/sessions/{id}/artifacts/json` returns session summary

---

## Frontend Implementation

### Project Structure

```
frontend/src/
├── components/
│   ├── SessionSetup.tsx     # Interview creation form
│   ├── InterviewApp.tsx     # Main interview interface
│   ├── AudioOrb.tsx         # 3D visualization
│   ├── TranscriptPanel.tsx  # Conversation display
│   ├── AssetOverlay.tsx     # Image/video viewer
│   ├── VideoPlayer.tsx      # Custom video controls
│   └── TopBar.tsx           # Header with controls
├── stores/
│   └── interviewStore.ts    # Zustand state management
├── services/
│   └── api.ts               # HTTP and WebSocket client
├── hooks/
│   └── useAudioAnalyzer.ts  # Volume analysis
└── types/
    └── session.ts           # TypeScript interfaces
```

### State Management

The application uses Zustand for global state. The store tracks session data, connection status, transcript entries, and the currently displayed asset:

```typescript
interface InterviewState {
    sessionId: string | null
    assets: Asset[]
    isConnected: boolean
    agentState: 'idle' | 'listening' | 'thinking' | 'speaking'
    transcript: TranscriptEntry[]
    currentAsset: Asset | null

    // Volume getters for visualization
    getOutputVolume: () => number
    getInputVolume: () => number
}
```

The store provides actions for managing the interview lifecycle: initializing sessions, adding transcript entries, showing/hiding assets, and resetting state.

### Session Setup Component

The setup form collects the interview prompt, asset files, and optional knowledge base. File inputs accept images (PNG, JPG, WEBP, GIF), documents (PPTX, PDF), and videos (MP4, WEBM).

On submission, it calls the API to create a session, stores the response, and transitions to the interview view.

### Interview Application Component

This is the main interface that manages WebRTC and WebSocket connections. The connection flow:

1. Request microphone permission with echo cancellation and noise suppression
2. Create RTCPeerConnection with Google's STUN server
3. Add audio track to the connection
4. Generate SDP offer and wait for ICE gathering
5. Send offer to backend, receive answer
6. Set up audio output for bot speech
7. Connect WebSocket for real-time messages

The component handles incoming WebSocket messages:

```typescript
ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    switch (message.type) {
        case 'transcript':
            // Add or update transcript entry
            break
        case 'show_asset':
            // Display image or video
            break
        case 'hide_asset':
            // Clear display
            break
        case 'agent_state':
            // Update visualization state
            break
    }
}
```

### Audio Visualization (AudioOrb)

The 3D orb uses React Three Fiber with custom GLSL shaders. The vertex shader applies noise-based displacement that responds to audio volume. The fragment shader mixes colors based on the agent's state:

- **Idle** (purple): Subtle pulsing, low activity
- **Listening** (blue): Responding to user input
- **Thinking** (orange): Processing, animated
- **Speaking** (green): High activity, volume-reactive

Volume levels drive the displacement amplitude, creating a reactive visual that pulses with speech.

### Asset Display

When the bot calls `show_asset`, the frontend receives the asset data through WebSocket. Images display in a floating overlay with the title. Videos use a custom player that supports:

- Auto-play on display
- Play/pause toggle
- Progress bar with seeking
- Video clips (start_time and end_time)

The clip feature lets the bot show specific segments of longer videos.

---

## Voice Pipeline

### Pipeline Architecture

The Pipecat pipeline processes audio through a series of connected components:

```
Transport Input → Deepgram STT → TranscriptForwarder → Context Aggregator
                                                              ↓
Transport Output ← Cartesia TTS ← LLM (OpenAI/Groq) ← Context Aggregator
```

### Speech-to-Text (Deepgram)

Deepgram's Nova 2 model provides real-time transcription with low latency. The service produces two types of frames:

- **Interim frames**: Partial results as the user speaks, enabling real-time display
- **Final frames**: Complete utterances with punctuation after VAD triggers

The TranscriptForwarder component captures both frame types and sends them to the frontend via WebSocket. Only final frames are persisted to the session transcript.

### LLM Integration

The system prompt instructs the AI to act as an interviewer named Maya. It includes the user's interview instructions, a list of available assets, and knowledge base terms if provided.

Function calling enables the bot to interact with the interface:

```python
tools = [
    {
        "name": "show_asset",
        "description": "Display an image or video to the user",
        "parameters": {
            "asset_id": {"type": "string"},
            "start_time": {"type": "number"},  # For video clips
            "end_time": {"type": "number"}
        }
    },
    {
        "name": "hide_asset",
        "description": "Hide the currently displayed asset"
    },
    {
        "name": "kb_lookup",
        "description": "Look up a term in the knowledge base",
        "parameters": {
            "term": {"type": "string"}
        }
    }
]
```

When the LLM calls a function, Pipecat routes it to the appropriate handler. The handler executes the action (sending a WebSocket message or querying the knowledge base) and returns a result that feeds back into the conversation.

### Text-to-Speech (Cartesia)

Cartesia synthesizes natural-sounding speech from the LLM's text output. The audio streams in real-time, so playback begins before the entire response is generated. This reduces perceived latency significantly.

The voice is configurable through the `CARTESIA_VOICE_ID` environment variable. The default voice provides a warm, professional tone suitable for interviews.

### Voice Activity Detection

Silero VAD determines when the user stops speaking. The stop threshold is set to 0.8 seconds of silence, balancing responsiveness with accuracy. When VAD triggers, the STT finalizes the transcript and the LLM begins processing.

The pipeline also supports interruptions, allowing users to cut off the bot mid-sentence by speaking.

---

## WebRTC Communication

### Connection Establishment

The WebRTC connection uses standard offer/answer negotiation:

1. **Client creates offer**: The browser generates an SDP offer describing its audio capabilities
2. **ICE gathering**: The client discovers its network addresses through STUN
3. **Server receives offer**: FastAPI endpoint receives the SDP and creates a peer connection
4. **Transport setup**: Pipecat's SmallWebRTCTransport wraps the connection with audio processing
5. **Answer generation**: The server creates an SDP answer with its capabilities
6. **Connection established**: Both sides exchange audio through the peer connection

### Audio Configuration

Input audio from the user's microphone runs at 16kHz sample rate. The browser applies echo cancellation, noise suppression, and automatic gain control before sending.

Output audio from the bot runs at 24kHz for higher quality speech synthesis.

### NAT Traversal

The system uses Google's public STUN server (`stun:stun.l.google.com:19302`) for NAT traversal. STUN helps clients behind firewalls discover their external IP addresses, enabling direct peer connections in most network configurations.

---

## Asset Processing

### Supported Formats

The asset processor handles several file types:

| Format | Processing | Output |
|--------|-----------|--------|
| PNG, JPG, WEBP, GIF | Direct copy | Original format |
| MP4, WEBM | Direct copy | Original format |
| PPTX, PPT | Convert to PDF, then images | WebP slides |
| PDF | Render pages to images | WebP pages |

### Document Conversion

PowerPoint files go through a two-step conversion:

1. **PPTX to PDF**: LibreOffice runs in headless mode to convert the presentation
2. **PDF to Images**: PyMuPDF renders each page at 2x resolution for quality

Each slide becomes a separate image asset with an ID like `slide-001`, `slide-002`, etc.

PDF files skip the first step and go directly to image rendering.

The conversion requires LibreOffice installed on the system. The processor automatically detects LibreOffice's location on Windows, macOS, and Linux.

### Storage Structure

Processed files are stored in a session-specific directory:

```
storage/
├── assets/
│   └── {session_id}/
│       ├── slide-001.webp
│       ├── slide-002.webp
│       ├── img-a1b2c3d4.png
│       └── vid-e5f6g7h8.mp4
└── sessions/
    └── {session_id}.json
```

Assets are served through FastAPI's static file handler at `/storage/{session_id}/filename`.

---

## Session Management

### Lifecycle

A session goes through several states:

1. **Created**: User submits the setup form, assets are processed, session is persisted
2. **Active**: WebRTC connection established, conversation in progress
3. **Ended**: User clicks end, session marked complete with timestamp

### Persistence

Sessions are stored as JSON files in the storage directory. The session manager loads them lazily when requested and saves after each transcript update.

```json
{
    "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
    "prompt": "Interview the candidate about their React experience",
    "assets": [...],
    "knowledge_base": {...},
    "transcript": [
        {
            "speaker": "bot",
            "text": "Hello! I'm Maya, and I'll be your interviewer today.",
            "ts": "2025-12-01T17:30:05.000Z",
            "is_final": true
        }
    ],
    "created_at": "2025-12-01T17:30:00.000Z",
    "ended_at": "2025-12-01T17:45:32.000Z"
}
```

### Transcript Export

The artifacts endpoint provides transcripts in two formats:

**JSON format** includes structured data with speaker, text, and timestamp for each turn.

**Plain text format** provides a human-readable version:
```
[2025-12-01T17:30:05Z] Maya: Hello! I'm Maya, and I'll be your interviewer today.
[2025-12-01T17:30:12Z] You: Hi Maya, nice to meet you.
```

---

## Configuration

### Environment Variables

Create a `.env` file in the backend directory with your API keys:

```env
# Speech-to-Text (Deepgram)
DEEPGRAM_API_KEY=your_deepgram_key

# Text-to-Speech (Cartesia)
CARTESIA_API_KEY=your_cartesia_key
CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091

# LLM Provider ("openai" or "groq")
LLM_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# Groq
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

# Storage
STORAGE_PATH=./storage
```

For the frontend, set the API URL in `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

In production, point this to your backend's public URL.

### LLM Selection

Switch between OpenAI and Groq by changing `LLM_PROVIDER`:

- **OpenAI** (`gpt-4o-mini`): Better reasoning, slightly higher latency
- **Groq** (`llama-3.3-70b-versatile`): Faster responses, good for real-time

Both support the same function calling interface.

---

## Deployment

### Local Development

Start the backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

### Docker

Build and run with Docker Compose:

```bash
docker-compose up --build
```

For production, use the production compose file:

```bash
docker-compose -f docker-compose.prod.yml up --build
```

### Railway Deployment

The project includes `railway.toml` for Railway.app deployment:

1. Connect your GitHub repository to Railway
2. Set environment variables in the Railway dashboard
3. Create a volume and mount it at `/data`
4. Set `STORAGE_PATH=/data` in environment variables

### Netlify Deployment (Frontend)

The frontend includes `netlify.toml` for Netlify deployment:

1. Connect the frontend directory to Netlify
2. Set `VITE_API_URL` to your backend URL
3. Deploy - Netlify will build and serve the React app

---

## Dependencies

### Backend

Core dependencies:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pipecat-ai` - Voice pipeline orchestration
- `pipecat-ai[deepgram]` - STT service
- `pipecat-ai[cartesia]` - TTS service
- `pipecat-ai[openai]` - OpenAI LLM
- `pipecat-ai[groq]` - Groq LLM
- `pipecat-ai[webrtc]` - WebRTC transport
- `pipecat-ai[silero]` - VAD

Asset processing:
- `PyMuPDF` - PDF rendering
- `Pillow` - Image processing
- `PyYAML` - Knowledge base parsing

### Frontend

Core dependencies:
- `react` - UI framework
- `typescript` - Type safety
- `vite` - Build tool
- `zustand` - State management
- `three` - 3D graphics
- `@react-three/fiber` - React Three.js integration
- `tailwindcss` - Styling

---

## Troubleshooting

### Common Issues

**Microphone not working**: Check browser permissions. The app requires microphone access for voice input.

**PPTX conversion fails**: Ensure LibreOffice is installed. On Windows, it should be in Program Files. On Linux/macOS, `soffice` should be in your PATH.

**WebRTC connection fails**: Check firewall settings. The app uses STUN for NAT traversal but may need additional configuration in restrictive networks.

**Frontend shows localhost errors**: Make sure `VITE_API_URL` is set correctly and the frontend was rebuilt after changing environment variables.

---

## License

This project is proprietary software developed by Bilal Karadeniz.

---

*For questions or support, contact the development team.*
