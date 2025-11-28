import { useCallback, useState } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { endSession, endWebRTCSession } from '../services/api';
import { MicIndicator } from './MicIndicator';

interface TopBarProps {
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function TopBar({ onConnect, onDisconnect }: TopBarProps) {
  const {
    sessionId,
    isConnected,
    isConnecting,
    isRecording,
    reset
  } = useInterviewStore();

  const [isLoading, setIsLoading] = useState(false);

  const handleStart = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConnect();
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onConnect]);

  const handleStop = useCallback(async () => {
    setIsLoading(true);
    try {
      await onDisconnect();
      if (sessionId) {
        await endWebRTCSession(sessionId);
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onDisconnect, sessionId]);

  const handleEndSession = useCallback(async () => {
    if (isConnected) {
      await handleStop();
    }
    if (sessionId) {
      try {
        await endSession(sessionId);
      } catch (e) {
        console.error('Failed to end session:', e);
      }
    }
    reset();
  }, [isConnected, handleStop, sessionId, reset]);

  return (
    <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">Interview Session</h1>
        {sessionId && (
          <span className="text-sm text-gray-400">
            ID: {sessionId.slice(0, 8)}...
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <MicIndicator isActive={isRecording} />

        {!isConnected ? (
          <button
            onClick={handleStart}
            disabled={isLoading || isConnecting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed
                       rounded-lg font-medium text-white transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Start Interview'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed
                       rounded-lg font-medium text-white transition-colors"
          >
            Stop
          </button>
        )}

        <button
          onClick={handleEndSession}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium text-white transition-colors"
        >
          End Session
        </button>
      </div>
    </header>
  );
}
