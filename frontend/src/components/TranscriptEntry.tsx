import { format } from 'date-fns';
import clsx from 'clsx';
import type { TranscriptEntry as TranscriptEntryType } from '../types/session';

interface TranscriptEntryProps {
  entry: TranscriptEntryType;
}

export function TranscriptEntry({ entry }: TranscriptEntryProps) {
  const isBot = entry.speaker === 'bot';

  return (
    <div
      className={clsx(
        'p-3 rounded-lg',
        isBot ? 'bg-blue-900/30' : 'bg-gray-700/50',
        !entry.isFinal && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={clsx(
          'text-sm font-medium',
          isBot ? 'text-blue-400' : 'text-green-400'
        )}>
          {isBot ? 'Maya' : 'You'}
        </span>
        <span className="text-xs text-gray-500">
          {format(entry.timestamp, 'HH:mm:ss')}
        </span>
        {!entry.isFinal && (
          <span className="text-xs text-yellow-500 animate-pulse">
            transcribing...
          </span>
        )}
      </div>
      <p className="text-gray-200">{entry.text}</p>
    </div>
  );
}
