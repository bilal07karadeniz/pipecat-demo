import { useEffect, useRef, useCallback } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { getWebSocketUrl, API_BASE } from '../services/api';
import { createAudioAnalyzer } from '../hooks/useAudioAnalyzer';
import { TopBar } from './TopBar';
import { TranscriptPanel } from './TranscriptPanel';
import { VisualPanel } from './VisualPanel';
import type { BotMessage } from '../types/session';
import type { AgentState } from './AudioOrb';

export function InterviewApp() {
  const {
    sessionId,
    webrtcUrl,
    setConnected,
    setConnecting,
    setRecording,
    setAgentState,
    setVolumeGetters,
    addTranscriptEntry,
    updateLastTranscript,
    showAsset,
    hideAsset,
  } = useInterviewStore();

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);
  const inputAnalyzerRef = useRef(createAudioAnalyzer());
  const outputAnalyzerRef = useRef(createAudioAnalyzer());

  // Handle WebSocket messages from bot
  const handleBotMessage = useCallback((message: BotMessage) => {
    switch (message.type) {
      case 'transcript':
        if (message.text && message.speaker) {
          const isFinal = message.is_final ?? true;
          const speaker = message.speaker as 'user' | 'bot';

          if (isFinal) {
            // Final transcript - add as new entry
            addTranscriptEntry({
              speaker,
              text: message.text,
              timestamp: new Date(),
              isFinal: true,
            });
          } else {
            // Interim transcript - update existing or create new
            updateLastTranscript(speaker, message.text, false);
          }

          // Infer agent state from transcript
          if (speaker === 'bot') {
            setAgentState(isFinal ? 'idle' : 'speaking');
          } else if (speaker === 'user') {
            setAgentState('listening');
          }
        }
        break;
      case 'agent_state':
        // Handle explicit agent state updates from backend
        if (message.state) {
          setAgentState(message.state as AgentState);
        }
        break;
      case 'show_asset':
        if (message.asset_id) {
          showAsset(message.asset_id, message.asset, message.start_time, message.end_time);
        }
        break;
      case 'hide_asset':
        hideAsset();
        break;
    }
  }, [addTranscriptEntry, updateLastTranscript, showAsset, hideAsset, setAgentState]);

  // Connect to WebRTC
  const connect = useCallback(async () => {
    if (!sessionId || !webrtcUrl) return;

    setConnecting(true);

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support microphone access. Please use a modern browser.');
      }

      // Get user media with error handling
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (mediaError: unknown) {
        const err = mediaError as Error;
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('Microphone access denied. Please allow microphone access and try again.');
        } else if (err.name === 'NotReadableError') {
          throw new Error('Microphone is in use by another application. Please close other apps using the microphone.');
        } else {
          throw new Error(`Microphone error: ${err.message}`);
        }
      }
      streamRef.current = stream;

      // Set up input audio analyzer for user's microphone
      inputAnalyzerRef.current.setupAnalyzer(stream);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Add audio track
      stream.getAudioTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Handle incoming audio
      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
        outputAudioRef.current = audio;

        // Set up output audio analyzer for bot's voice
        outputAnalyzerRef.current.setupAnalyzer(event.streams[0]);

        // Set volume getters in store
        setVolumeGetters(
          outputAnalyzerRef.current.getVolume,
          inputAnalyzerRef.current.getVolume
        );
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              resolve();
            }
          };
        }
      });

      // Send offer to server
      const response = await fetch(`${API_BASE}${webrtcUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to establish WebRTC connection');
      }

      const answer = await response.json();

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription({
        sdp: answer.sdp,
        type: answer.type,
      }));

      // Connect WebSocket for messages
      const ws = new WebSocket(getWebSocketUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleBotMessage(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnected(true);
          setRecording(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnected(false);
          setRecording(false);
        }
      };

      setConnected(true);
      setRecording(true);

    } catch (error) {
      console.error('Connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      alert(errorMessage);
      setConnecting(false);
      setConnected(false);
    }
  }, [sessionId, webrtcUrl, setConnected, setConnecting, setRecording, setVolumeGetters, handleBotMessage]);

  // Disconnect
  const disconnect = useCallback(async () => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Cleanup audio analyzers
    inputAnalyzerRef.current.cleanup();
    outputAnalyzerRef.current.cleanup();

    // Stop audio playback
    if (outputAudioRef.current) {
      outputAudioRef.current.pause();
      outputAudioRef.current.srcObject = null;
      outputAudioRef.current = null;
    }

    setConnected(false);
    setRecording(false);
    setAgentState('idle');
  }, [setConnected, setRecording, setAgentState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <TopBar onConnect={connect} onDisconnect={disconnect} />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <TranscriptPanel className="w-full md:w-1/3 lg:w-1/4 h-1/2 md:h-full" />
        <VisualPanel className="flex-1 h-1/2 md:h-full" />
      </div>
    </div>
  );
}
