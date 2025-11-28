# Pipecat Voice Interview Bot

A real-time AI-powered voice interview application built with Pipecat, featuring speech-to-text, text-to-speech, and intelligent conversation capabilities with visual asset display.

## Features

- 🎙️ **Real-time Voice Interaction** - Conduct natural voice conversations with AI interviewer
- 🎨 **Visual Asset Display** - Upload and display images, videos, and PowerPoint presentations during interviews
- 📝 **Live Transcription** - Real-time transcription of both user and AI responses
- 🧠 **Knowledge Base Integration** - Custom knowledge base for domain-specific terminology
- 🌊 **Interactive Visualizations** - Beautiful 3D audio orb that responds to voice
- ⚡ **WebRTC Technology** - Low-latency voice communication
- 📊 **Session Management** - Track and manage interview sessions

## Tech Stack

### Backend
- **Framework**: FastAPI (Python)
- **Voice Pipeline**: Pipecat
- **Speech-to-Text**: Deepgram Nova 2
- **Text-to-Speech**: Cartesia TTS
- **LLM**: Groq (Llama 3.3 70B)
- **Communication**: WebRTC + WebSockets

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **3D Graphics**: Three.js + React Three Fiber
- **State Management**: Zustand

## Prerequisites

- **Python** 3.9 or higher
- **Node.js** 18 or higher
- **LibreOffice** (for PowerPoint conversion) - [Download here](https://www.libreoffice.org/download/download/)
- **API Keys** (required):
  - [Deepgram API Key](https://deepgram.com/)
  - [Cartesia API Key](https://cartesia.ai/)
  - [Groq API Key](https://groq.com/)

## Installation

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd pipecat-demo
```

### 2. Backend Setup

#### Create Virtual Environment
```bash
cd backend
python -m venv venv
```

#### Activate Virtual Environment
**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

#### Install Dependencies
```bash
pip install -r requirements.txt
```

#### Configure Environment Variables
Create a `.env` file in the `backend` directory:
```env
# API Keys
DEEPGRAM_API_KEY=your_deepgram_api_key_here
CARTESIA_API_KEY=your_cartesia_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Cartesia Voice Settings
CARTESIA_VOICE_ID=a0e99841-438c-4a64-b679-ae501e7d6091

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Storage
STORAGE_PATH=./storage
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

#### Configure Frontend Environment
Create a `.env` file in the `frontend` directory:
```env
VITE_API_BASE_URL=http://localhost:8000
```

## Running the Application

### Development Mode

#### 1. Start Backend Server
```bash
cd backend
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
python -m app.main
```
Backend will run on `http://localhost:8000`

#### 2. Start Frontend Development Server
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

### Production Mode

#### Build Frontend
```bash
cd frontend
npm run build
```

#### Run Backend (serves both API and frontend)
```bash
cd backend
venv\Scripts\activate  # Windows
python -m app.main
```
Access the application at `http://localhost:8000`

## Usage

### Creating an Interview Session

1. **Navigate to the Application**
   - Open your browser to `http://localhost:5173` (dev) or `http://localhost:8000` (prod)

2. **Configure Your Interview**
   - Enter custom **Prompt/Instructions** for the AI interviewer
   - Upload **Assets** (images, videos, or PowerPoint files) - optional
   - Upload a **Knowledge Base** (YAML file with term definitions) - optional

3. **Start the Interview**
   - Click "Start Session"
   - Allow microphone permissions when prompted
   - Click "Connect" to begin the voice interview

4. **During the Interview**
   - Speak naturally with the AI interviewer
   - View real-time transcription in the left panel
   - The AI can display uploaded assets during the conversation
   - Watch the interactive audio orb respond to speech

5. **Download Results**
   - After the interview, download the transcript or audio recording
   - Access uploaded assets and session data

### Knowledge Base Format

Create a YAML file with term definitions:
```yaml
terms:
  - term: "API"
    definition: "Application Programming Interface - a set of rules for building software applications"
  - term: "WebRTC"
    definition: "Web Real-Time Communication - enables peer-to-peer audio, video, and data sharing"
```

### Supported Asset Formats
- **Images**: PNG, JPG, JPEG, WebP, GIF
- **Videos**: MP4, WebM
- **Presentations**: PPT, PPTX (auto-converted to images)

## Project Structure

```
pipecat-demo/
├── backend/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── bot/          # Pipecat pipeline & handlers
│   │   ├── models/       # Data models
│   │   ├── services/     # Business logic
│   │   ├── config.py     # Configuration
│   │   └── main.py       # FastAPI application
│   ├── storage/          # Session data & assets
│   └── requirements.txt  # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API services
│   │   ├── stores/       # State management
│   │   └── types/        # TypeScript types
│   └── package.json      # Node dependencies
└── test_assets/          # Sample files for testing
```

## API Endpoints

### Session Management
- `POST /api/sessions` - Create a new interview session
- `GET /api/sessions/{session_id}` - Get session details
- `GET /api/sessions/{session_id}/transcript` - Download transcript

### Assets
- `POST /api/sessions/{session_id}/assets` - Upload assets

### WebRTC
- `POST /api/webrtc/{session_id}/offer` - WebRTC connection endpoint
- `WS /api/sessions/{session_id}/ws` - WebSocket for messages

## Troubleshooting

### Microphone Not Working
- Ensure browser has microphone permissions
- Check that no other application is using the microphone
- Use HTTPS in production (required for microphone access)

### PowerPoint Conversion Fails
- Install LibreOffice: https://www.libreoffice.org/download/download/
- Ensure LibreOffice is in your system PATH

### WebRTC Connection Issues
- Check firewall settings
- Ensure both frontend and backend are running
- Verify API keys are correct in `.env` file

### "Module not found" Errors
- Backend: Ensure virtual environment is activated
- Frontend: Run `npm install` again

## Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Description | Required |
|----------|-------------|----------|
| `DEEPGRAM_API_KEY` | Deepgram API key for speech-to-text | Yes |
| `CARTESIA_API_KEY` | Cartesia API key for text-to-speech | Yes |
| `GROQ_API_KEY` | Groq API key for LLM | Yes |
| `CARTESIA_VOICE_ID` | Voice ID for Cartesia TTS | No (has default) |
| `HOST` | Server host | No (default: 0.0.0.0) |
| `PORT` | Server port | No (default: 8000) |
| `STORAGE_PATH` | Path for session storage | No (default: ./storage) |

### Frontend (`frontend/.env`)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_BASE_URL` | Backend API URL | No (default: http://localhost:8000) |

## License

This project is provided as-is for demonstration purposes.

## Support

For issues or questions, please open an issue on the GitHub repository.
