# Pipecat Voice Interview Bot - API Documentation

**Base URL:** `https://your-domain.com` or `http://localhost:8000`

---

## Quick Start

### Option A: Using the UI
1. Go to `https://your-domain.com`
2. Upload assets, enter prompt, optionally add knowledge base
3. Click "Start Interview"

### Option B: Using the API (Programmatic)
1. `POST /api/sessions` with prompt, assets, and optional knowledge base
2. Get `session_id` from response
3. Redirect user to: `https://your-domain.com?session={session_id}`
4. User lands directly on the interview page (no upload needed)
5. After interview, fetch transcript via API

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create a new session |
| GET | `/api/sessions/{session_id}` | Get session details |
| POST | `/api/sessions/{session_id}/end` | End a session |
| GET | `/api/sessions/{session_id}/artifacts/json` | Get session summary |
| GET | `/api/sessions/{session_id}/artifacts/transcript` | Get transcript (JSON) |
| GET | `/api/sessions/{session_id}/artifacts/transcript.txt` | Get transcript (text) |
| POST | `/api/webrtc/offer/{session_id}` | Start WebRTC connection |
| GET | `/api/webrtc/status/{session_id}` | Check connection status |
| GET | `/health` | Health check |

---

## 1. Create Session

Creates a new interview session with prompt, assets, and optional knowledge base.

**Endpoint:** `POST /api/sessions`

**Content-Type:** `multipart/form-data`

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Instructions for the AI interviewer |
| `assets` | file[] | Yes | Images, PDFs, PPTXs, or videos to show during interview |
| `kb` | file | No | Knowledge base file (YAML or JSON) |

**Supported Asset Types:**
- Images: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`
- Documents: `.pdf`, `.ppt`, `.pptx` (converted to images)
- Videos: `.mp4`, `.webm`

### Sample Request (cURL)

```bash
curl -X POST "https://your-domain.com/api/sessions" \
  -F "prompt=You are an AI interviewer. Ask the user about their experience with the product shown in the images." \
  -F "assets=@slide1.png" \
  -F "assets=@slide2.png" \
  -F "assets=@demo_video.mp4" \
  -F "kb=@knowledge_base.yaml"
```

### Sample Request (Python)

```python
import requests

url = "https://your-domain.com/api/sessions"

files = [
    ("assets", ("slide1.png", open("slide1.png", "rb"), "image/png")),
    ("assets", ("slide2.png", open("slide2.png", "rb"), "image/png")),
    ("assets", ("demo.mp4", open("demo.mp4", "rb"), "video/mp4")),
    ("kb", ("kb.yaml", open("knowledge_base.yaml", "rb"), "application/x-yaml")),
]

data = {
    "prompt": "You are an AI interviewer conducting a product demo. Show the slides and ask for feedback."
}

response = requests.post(url, data=data, files=files)
print(response.json())
```

### Sample Request (JavaScript/Fetch)

```javascript
const formData = new FormData();
formData.append('prompt', 'You are an AI interviewer. Ask about the product.');
formData.append('assets', fileInput.files[0]);
formData.append('assets', fileInput.files[1]);
formData.append('kb', kbFileInput.files[0]);

const response = await fetch('https://your-domain.com/api/sessions', {
  method: 'POST',
  body: formData
});

const session = await response.json();
console.log(session);
```

### Response

```json
{
  "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "webrtc_url": "/api/webrtc/offer/dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "asset_manifest": [
    {
      "asset_id": "img-3a32124e",
      "title": "slide1",
      "type": "image",
      "url": "/storage/dd7efc7e-e538-4166-a7e7-723b22d1d885/img-3a32124e.png"
    },
    {
      "asset_id": "vid-41542e37",
      "title": "demo",
      "type": "video",
      "url": "/storage/dd7efc7e-e538-4166-a7e7-723b22d1d885/vid-41542e37.mp4"
    }
  ]
}
```

---

## 2. Get Session Details

Returns full session data including assets. Used by frontend for direct URL loading.

**Endpoint:** `GET /api/sessions/{session_id}`

### Sample Request

```bash
curl "https://your-domain.com/api/sessions/dd7efc7e-e538-4166-a7e7-723b22d1d885"
```

### Response

```json
{
  "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "webrtc_url": "/api/webrtc/offer/dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "asset_manifest": [
    {
      "asset_id": "img-3a32124e",
      "title": "slide1",
      "type": "image",
      "url": "/storage/dd7efc7e-e538-4166-a7e7-723b22d1d885/img-3a32124e.png"
    },
    {
      "asset_id": "vid-41542e37",
      "title": "demo",
      "type": "video",
      "url": "/storage/dd7efc7e-e538-4166-a7e7-723b22d1d885/vid-41542e37.mp4"
    }
  ],
  "created_at": "2025-11-30T17:30:00.000Z",
  "ended_at": null,
  "transcript_count": 12
}
```

---

## 3. End Session

**Endpoint:** `POST /api/sessions/{session_id}/end`

### Sample Request

```bash
curl -X POST "https://your-domain.com/api/sessions/dd7efc7e-e538-4166-a7e7-723b22d1d885/end"
```

### Response

```json
{
  "status": "ended",
  "summary": {
    "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
    "turn_count": 12,
    "duration_seconds": 245
  }
}
```

---

## 4. Get Transcript (JSON)

Returns the full conversation transcript as JSON.

**Endpoint:** `GET /api/sessions/{session_id}/artifacts/transcript`

### Sample Request

```bash
curl "https://your-domain.com/api/sessions/dd7efc7e-e538-4166-a7e7-723b22d1d885/artifacts/transcript"
```

### Response

```json
{
  "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "entries": [
    {
      "speaker": "bot",
      "text": "Hello! I'm Maya, and I'll be guiding you through this product demonstration today.",
      "timestamp": "2025-11-30T17:30:05.000Z"
    },
    {
      "speaker": "user",
      "text": "Hi Maya, nice to meet you.",
      "timestamp": "2025-11-30T17:30:12.000Z"
    },
    {
      "speaker": "bot",
      "text": "Nice to meet you too! Let me show you our first slide.",
      "timestamp": "2025-11-30T17:30:15.000Z"
    }
  ]
}
```

---

## 5. Get Transcript (Plain Text)

Returns the transcript as plain text format.

**Endpoint:** `GET /api/sessions/{session_id}/artifacts/transcript.txt`

### Sample Request

```bash
curl "https://your-domain.com/api/sessions/dd7efc7e-e538-4166-a7e7-723b22d1d885/artifacts/transcript.txt"
```

### Response

```
Bot: Hello! I'm Maya, and I'll be guiding you through this product demonstration today.

User: Hi Maya, nice to meet you.

Bot: Nice to meet you too! Let me show you our first slide.
```

---

## 6. Get Session Summary (JSON)

Returns metadata and summary for the session.

**Endpoint:** `GET /api/sessions/{session_id}/artifacts/json`

### Sample Request

```bash
curl "https://your-domain.com/api/sessions/dd7efc7e-e538-4166-a7e7-723b22d1d885/artifacts/json"
```

### Response

```json
{
  "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "turn_count": 12,
  "asset_count": 3,
  "has_knowledge_base": true
}
```

---

## 7. WebRTC Connection

For real-time voice communication. This is typically handled by the frontend client.

**Endpoint:** `POST /api/webrtc/offer/{session_id}`

**Content-Type:** `application/json`

### Sample Request

```bash
curl -X POST "https://your-domain.com/api/webrtc/offer/dd7efc7e-e538-4166-a7e7-723b22d1d885" \
  -H "Content-Type: application/json" \
  -d '{
    "sdp": "v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\n...",
    "type": "offer"
  }'
```

### Response

```json
{
  "sdp": "v=0\r\no=- 654321 2 IN IP4 ...",
  "type": "answer",
  "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885"
}
```

---

## 8. WebSocket (Real-time Events)

Connect to receive real-time transcript updates and asset display commands.

**Endpoint:** `WS /api/webrtc/ws/{session_id}`

### Message Types Received

**Transcript Update:**
```json
{
  "type": "transcript",
  "speaker": "user",
  "text": "Hello there",
  "is_final": true
}
```

**Show Asset:**
```json
{
  "type": "show_asset",
  "asset_id": "img-3a32124e",
  "asset": {
    "asset_id": "img-3a32124e",
    "title": "slide1",
    "type": "image",
    "url": "/storage/session-id/img-3a32124e.png"
  }
}
```

**Hide Asset:**
```json
{
  "type": "hide_asset"
}
```

---

## 9. Check Connection Status

**Endpoint:** `GET /api/webrtc/status/{session_id}`

### Sample Request

```bash
curl "https://your-domain.com/api/webrtc/status/dd7efc7e-e538-4166-a7e7-723b22d1d885"
```

### Response

```json
{
  "session_id": "dd7efc7e-e538-4166-a7e7-723b22d1d885",
  "is_active": true
}
```

---

## 10. Health Check

**Endpoint:** `GET /health`

### Response

```json
{
  "status": "healthy"
}
```

---

## Knowledge Base Format

The knowledge base file should be YAML or JSON format:

### YAML Example (`knowledge_base.yaml`)

```yaml
terms:
  - term: KPI
    definition: Key Performance Indicator - a measurable value that demonstrates how effectively a company is achieving key business objectives.
    example: Monthly revenue growth rate is a common KPI.

  - term: ROI
    definition: Return on Investment - a performance measure used to evaluate the efficiency of an investment.
    example: If you invest $100 and get back $150, your ROI is 50%.

  - term: Q1
    definition: First quarter of the fiscal year, typically January through March.
```

### JSON Example (`knowledge_base.json`)

```json
{
  "terms": [
    {
      "term": "KPI",
      "definition": "Key Performance Indicator - a measurable value.",
      "example": "Monthly revenue growth rate is a common KPI."
    },
    {
      "term": "ROI",
      "definition": "Return on Investment.",
      "example": "If you invest $100 and get back $150, your ROI is 50%."
    }
  ]
}
```

---

## Complete Workflow Example (API → Direct Frontend)

This is the recommended flow for programmatic session creation:

### 1. Create Session via API

```python
import requests

# Create session with assets
response = requests.post(
    "https://your-domain.com/api/sessions",
    data={"prompt": "Conduct a product feedback interview."},
    files=[
        ("assets", ("slide.png", open("slide.png", "rb"), "image/png")),
        ("assets", ("presentation.pdf", open("presentation.pdf", "rb"), "application/pdf")),
        ("kb", ("terms.yaml", open("terms.yaml", "rb"), "application/x-yaml")),
    ]
)
session = response.json()
session_id = session["session_id"]
print(f"Created session: {session_id}")

# Generate the direct interview URL
interview_url = f"https://your-domain.com?session={session_id}"
print(f"Interview URL: {interview_url}")
```

### 2. Redirect User to Interview

Send the user to the interview URL. They will land directly on the bot page with all assets loaded:

```
https://your-domain.com?session=dd7efc7e-e538-4166-a7e7-723b22d1d885
```

**What happens:**
- Frontend detects `?session=` parameter
- Fetches session data from `GET /api/sessions/{session_id}`
- Loads assets and initializes WebRTC connection
- User starts talking to the bot immediately (no upload step)

### 3. After Interview - Get Transcript

```python
# Get transcript as JSON
transcript = requests.get(
    f"https://your-domain.com/api/sessions/{session_id}/artifacts/transcript"
).json()

print("Transcript:")
for entry in transcript["entries"]:
    print(f"{entry['speaker']}: {entry['text']}")

# Or get as plain text
transcript_txt = requests.get(
    f"https://your-domain.com/api/sessions/{session_id}/artifacts/transcript.txt"
).text
print(transcript_txt)
```

### 4. End Session

```python
# End session and get summary
result = requests.post(f"https://your-domain.com/api/sessions/{session_id}/end")
print(result.json())
```

---

## Direct URL Access

After creating a session via API, redirect users to the interview page:

```
https://your-domain.com?session={session_id}
```

**Example URLs:**
```
https://your-domain.com?session=dd7efc7e-e538-4166-a7e7-723b22d1d885
http://localhost:8000?session=dd7efc7e-e538-4166-a7e7-723b22d1d885
```

The frontend will:
1. Parse the `session` query parameter
2. Fetch session data from the API
3. Load all assets (images, PDFs, videos)
4. Start the WebRTC voice connection
5. Begin the interview automatically

---

## Error Responses

All errors return JSON with this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `400` - Bad request (missing fields, invalid file format)
- `404` - Session not found
- `500` - Server error

---

## Static Assets

Uploaded and processed assets are served from:

```
GET /storage/{session_id}/{filename}
```

Example:
```
https://your-domain.com/storage/dd7efc7e-e538-4166-a7e7-723b22d1d885/img-3a32124e.png
```
