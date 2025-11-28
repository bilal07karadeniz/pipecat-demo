import clsx from 'clsx';

interface MicIndicatorProps {
  isActive: boolean;
}

export function MicIndicator({ isActive }: MicIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          'w-3 h-3 rounded-full transition-colors',
          isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
        )}
      />
      <span className="text-sm text-gray-400">
        {isActive ? 'Recording' : 'Mic Ready'}
      </span>
    </div>
  );
}
