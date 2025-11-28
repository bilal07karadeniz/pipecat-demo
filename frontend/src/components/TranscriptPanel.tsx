import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useInterviewStore } from '../stores/interviewStore';
import { TranscriptEntry } from './TranscriptEntry';
import { DownloadButtons } from './DownloadButtons';

interface TranscriptPanelProps {
  className?: string;
}

export function TranscriptPanel({ className }: TranscriptPanelProps) {
  const transcript = useInterviewStore(state => state.transcript);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className={clsx('flex flex-col bg-gray-800', className)}>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="font-semibold text-white">Transcript</h2>
        <DownloadButtons />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {transcript.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Transcript will appear here once the interview starts...
          </p>
        ) : (
          transcript.map((entry) => (
            <TranscriptEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
