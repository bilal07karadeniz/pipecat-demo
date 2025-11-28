import { useState } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { downloadTranscript } from '../services/api';

export function DownloadButtons() {
  const sessionId = useInterviewStore(state => state.sessionId);
  const transcript = useInterviewStore(state => state.transcript);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (type: 'json' | 'txt') => {
    if (!sessionId) return;

    setIsDownloading(true);
    try {
      const blob = await downloadTranscript(sessionId, type);
      const filename = `transcript-${sessionId.slice(0, 8)}.${type}`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    const text = transcript
      .filter(t => t.isFinal)
      .map(t => `${t.speaker === 'bot' ? 'Maya' : 'You'}: ${t.text}`)
      .join('\n');

    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        disabled={transcript.length === 0}
        className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Copy to clipboard"
      >
        <CopyIcon className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleDownload('txt')}
        disabled={isDownloading || !sessionId}
        className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Download TXT"
      >
        <DownloadIcon className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleDownload('json')}
        disabled={isDownloading || !sessionId}
        className="px-2 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-600 rounded"
        title="Download JSON"
      >
        JSON
      </button>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}
