import type { SessionResponse } from '../types/session';

// Use VITE_API_URL if set and not empty, otherwise fallback to localhost for dev
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function createSession(
  prompt: string,
  assets: File[],
  kb?: File
): Promise<SessionResponse> {
  const formData = new FormData();
  formData.append('prompt', prompt);

  assets.forEach(file => {
    formData.append('assets', file);
  });

  if (kb) {
    formData.append('kb', kb);
  }

  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to create session');
  }

  return response.json();
}

export async function endSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
    method: 'POST',
  });
}

export async function endWebRTCSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/webrtc/end/${sessionId}`, {
    method: 'POST',
  });
}

export async function downloadTranscript(
  sessionId: string,
  format: 'json' | 'txt'
): Promise<Blob> {
  const endpoint = format === 'json'
    ? `/api/sessions/${sessionId}/artifacts/transcript`
    : `/api/sessions/${sessionId}/artifacts/transcript.txt`;

  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error('Failed to download transcript');
  }
  return response.blob();
}

export async function downloadSummary(sessionId: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE}/api/sessions/${sessionId}/artifacts/json`
  );
  if (!response.ok) {
    throw new Error('Failed to download summary');
  }
  return response.blob();
}

export function getWebSocketUrl(sessionId: string): string {
  const wsBase = API_BASE.replace('http', 'ws');
  return `${wsBase}/api/webrtc/ws/${sessionId}`;
}

export function getAssetUrl(assetPath: string): string {
  if (assetPath.startsWith('http')) {
    return assetPath;
  }
  return `${API_BASE}${assetPath}`;
}
